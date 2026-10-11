import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  getSession,
  InvalidCredentialsError,
  issueLoginKey,
  listAccounts,
  LoginLockedError,
  login,
  loginWithKey,
  MAX_LOGIN_FAILURES,
  revokeLoginKey,
  setPassword,
} from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";

function createDeps(): AccountsAuthDeps {
  let counter = 0;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `generated-${++counter}`,
    // 平文がそのまま残らないよう、文字コードを並べただけの決定的なダミーハッシュにする。
    hasher: {
      hash: async (password: string, salt: string) =>
        Array.from(`${salt}:${password}`, (c) => c.charCodeAt(0).toString(16)).join(""),
    },
    now: () => 1_000_000,
  };
}

async function setup() {
  const deps = createDeps();
  await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
  await addMember(deps, { id: "alice", name: "Alice" });
  await addMember(deps, { id: "bob", name: "Bob" });
  return deps;
}

const message = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.message);

describe("login key", () => {
  it("logs a participant in with the issued key and resolves the session", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    const { token, member } = await loginWithKey(deps, { id: "alice", key });
    expect(member).toEqual({ id: "alice", name: "Alice" });
    expect(await getSession(deps, token)).toEqual(member);
  });

  it("issues long, distinct, URL-safe keys per member when ids are real UUIDs", async () => {
    const deps = { ...(await setup()), generateId: () => crypto.randomUUID() };
    const a = await issueLoginKey(deps, { id: "alice" });
    const b = await issueLoginKey(deps, { id: "bob" });
    expect(a.key).not.toBe(b.key);
    // UUID 2つ分(ハイフン除去で hex 64 文字 = 約244ビットのランダム値)
    expect(a.key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores only a hash, never the plaintext key", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    const stored = (await deps.storage.get("accounts-login-key/alice")) ?? "";
    expect(stored).not.toBe("");
    expect(stored).not.toContain(key);
  });

  it("rejects wrong keys, unknown ids and members without a key identically", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    const messages = await Promise.all([
      message(loginWithKey(deps, { id: "alice", key: "wrong" })),
      message(loginWithKey(deps, { id: "ghost", key })),
      message(loginWithKey(deps, { id: "bob", key })),
    ]);
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe(new InvalidCredentialsError().message);
  });

  it("does not accept another member's key", async () => {
    const deps = await setup();
    await issueLoginKey(deps, { id: "alice" });
    const bob = await issueLoginKey(deps, { id: "bob" });
    await expect(loginWithKey(deps, { id: "alice", key: bob.key })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("reissuing invalidates the previous key", async () => {
    const deps = await setup();
    const first = await issueLoginKey(deps, { id: "alice" });
    const second = await issueLoginKey(deps, { id: "alice" });
    await expect(loginWithKey(deps, { id: "alice", key: first.key })).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(loginWithKey(deps, { id: "alice", key: second.key })).resolves.toMatchObject({ member: { id: "alice" } });
  });

  it("revoking invalidates the key", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    await revokeLoginKey(deps, { id: "alice" });
    await expect(loginWithKey(deps, { id: "alice", key })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("refuses to issue keys to admins or unknown members", async () => {
    const deps = await setup();
    await expect(issueLoginKey(deps, { id: "admin" })).rejects.toThrow(/non-admin/);
    await expect(issueLoginKey(deps, { id: "ghost" })).rejects.toThrow(/not found/);
  });

  it("does not let a key log in a member who later became an admin", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    const { updateMember } = await import("../accounts-use-cases");
    await updateMember(deps, { id: "alice", name: "Alice", isAdmin: true });
    await expect(loginWithKey(deps, { id: "alice", key })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("locks after repeated failures even for the right key, sharing the counter with password login", async () => {
    const deps = await setup();
    await setPassword(deps, { id: "alice", password: "correct-horse" });
    const { key } = await issueLoginKey(deps, { id: "alice" });
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
      await expect(loginWithKey(deps, { id: "alice", key: "wrong" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    // 最後の1回はパスワード側の失敗でも同じカウンタに数えられる
    await expect(login(deps, { id: "alice", password: "wrong-password" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(loginWithKey(deps, { id: "alice", key })).rejects.toBeInstanceOf(LoginLockedError);
  });

  it("a successful key login clears earlier failures", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
      await expect(loginWithKey(deps, { id: "alice", key: "wrong" })).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await loginWithKey(deps, { id: "alice", key });
    await expect(loginWithKey(deps, { id: "alice", key: "wrong" })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("deleting a member removes the key", async () => {
    const deps = await setup();
    await issueLoginKey(deps, { id: "alice" });
    await deleteMember(deps, "alice");
    expect(await deps.storage.get("accounts-login-key/alice")).toBeNull();
  });

  it("listAccounts flags members that have a key, without exposing it", async () => {
    const deps = await setup();
    const { key } = await issueLoginKey(deps, { id: "alice" });
    const list = await listAccounts(deps);
    expect(list.find((m) => m.id === "alice")?.hasLoginKey).toBe(true);
    expect(list.find((m) => m.id === "bob")?.hasLoginKey).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain(key);
  });
});
