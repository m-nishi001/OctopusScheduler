import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  getSession,
  InvalidCredentialsError,
  listAccounts,
  listMembers,
  login,
  logout,
  replaceAllMembers,
  SESSION_TTL_MS,
  setPassword,
  updateMember,
} from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";

function createDeps(): AccountsAuthDeps & { advance(ms: number): void } {
  let counter = 0;
  let time = 1_000_000;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `generated-${++counter}`,
    // 平文がそのまま残らないよう、文字コードを並べただけの決定的なダミーハッシュにする。
    hasher: {
      hash: async (password: string, salt: string) =>
        Array.from(`${salt}:${password}`, (c) => c.charCodeAt(0).toString(16)).join(""),
    },
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}

async function adminWithPassword(deps: AccountsAuthDeps, password = "correct-horse") {
  await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
  await setPassword(deps, { id: "admin", password });
}

describe("accounts auth", () => {
  it("logs in with the right password and resolves the session", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    const { token, member } = await login(deps, { id: "admin", password: "correct-horse" });
    expect(member).toEqual({ id: "admin", name: "管理者", isAdmin: true });
    expect(await getSession(deps, token)).toEqual(member);
  });

  it("rejects wrong passwords, unknown ids and members without a password identically", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    await addMember(deps, { id: "nopass", name: "未設定" });
    const messages = await Promise.all(
      [
        { id: "admin", password: "wrong-password" },
        { id: "ghost", password: "correct-horse" },
        { id: "nopass", password: "correct-horse" },
      ].map((args) => login(deps, args).then(() => "ok", (e: Error) => e.message))
    );
    expect(messages).toEqual(["Invalid id or password", "Invalid id or password", "Invalid id or password"]);
  });

  it("throws InvalidCredentialsError so the endpoint can mark it non-retryable", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    await expect(login(deps, { id: "admin", password: "wrong-password" })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it("rejects short passwords and unknown members when setting a password", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    await expect(setPassword(deps, { id: "u1", password: "short" })).rejects.toThrow();
    await expect(setPassword(deps, { id: "missing", password: "long-enough-pw" })).rejects.toThrow();
  });

  it("does not store the plain password", async () => {
    const deps = createDeps();
    await adminWithPassword(deps, "secret-password");
    const stored = await deps.storage.get("accounts-credential/admin");
    expect(stored).not.toContain("secret-password");
  });

  it("expires sessions after the TTL", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    const { token } = await login(deps, { id: "admin", password: "correct-horse" });
    deps.advance(SESSION_TTL_MS - 1);
    expect(await getSession(deps, token)).not.toBeNull();
    deps.advance(1);
    expect(await getSession(deps, token)).toBeNull();
  });

  it("invalidates the session on logout and for unknown tokens", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    const { token } = await login(deps, { id: "admin", password: "correct-horse" });
    await logout(deps, token);
    expect(await getSession(deps, token)).toBeNull();
    expect(await getSession(deps, "unknown")).toBeNull();
    expect(await getSession(deps, "")).toBeNull();
  });

  it("invalidates the session and credential when the member is deleted", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    const { token } = await login(deps, { id: "admin", password: "correct-horse" });
    await deleteMember(deps, "admin");
    expect(await getSession(deps, token)).toBeNull();
    await addMember(deps, { id: "admin", name: "再作成" });
    await expect(login(deps, { id: "admin", password: "correct-horse" })).rejects.toThrow();
  });

  it("listAccounts flags isAdmin/hasPassword; listMembers exposes only id and name", async () => {
    const deps = createDeps();
    await adminWithPassword(deps);
    await addMember(deps, { id: "u1", name: "太郎" });
    expect(await listAccounts(deps)).toEqual([
      { id: "admin", name: "管理者", isAdmin: true, hasPassword: true },
      { id: "u1", name: "太郎" },
    ]);
    expect(await listMembers(deps)).toEqual([
      { id: "admin", name: "管理者" },
      { id: "u1", name: "太郎" },
    ]);
  });
});

describe("accounts isAdmin handling", () => {
  it("keeps isAdmin when updateMember omits it, and changes it when given", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
    expect(await updateMember(deps, { id: "admin", name: "改名" })).toEqual({
      id: "admin",
      name: "改名",
      isAdmin: true,
    });
    expect(await updateMember(deps, { id: "admin", name: "改名", isAdmin: false })).toEqual({
      id: "admin",
      name: "改名",
    });
  });

  it("replaceAllMembers neither grants nor revokes isAdmin", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
    await replaceAllMembers(deps, [
      { id: "admin", name: "管理者(改)" },
      { id: "u1", name: "太郎", isAdmin: true },
    ]);
    expect(await listAccounts(deps)).toEqual([
      { id: "admin", name: "管理者(改)", isAdmin: true },
      { id: "u1", name: "太郎" },
    ]);
  });
});
