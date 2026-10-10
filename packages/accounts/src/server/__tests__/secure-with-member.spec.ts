import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { wrapWithAuth } from "@octopus/infrastructures/interfaces";
import { addMember, login, setPassword } from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";
import { createSecureAdminWithMember, UNAUTHORIZED_RESPONSE } from "../secure";

const OK = JSON.stringify({ status: "success", data: "ok" });

async function setup() {
  const storage = new InMemoryKeyValueStorage();
  let counter = 0;
  const authDeps: AccountsAuthDeps = {
    storage,
    generateId: () => `id-${++counter}`,
    hasher: { hash: async (password: string, salt: string) => `${salt}|${password}` },
    now: () => 1000,
  };
  await addMember(authDeps, { id: "admin", name: "管理者", isAdmin: true });
  await setPassword(authDeps, { id: "admin", password: "correct-horse" });
  await addMember(authDeps, { id: "user", name: "一般" });
  await setPassword(authDeps, { id: "user", password: "correct-horse" });
  const adminToken = (await login(authDeps, { id: "admin", password: "correct-horse" })).token;
  const userToken = (await login(authDeps, { id: "user", password: "correct-horse" })).token;
  const wrap = createSecureAdminWithMember({ getStorage: () => storage, now: () => 1000 });
  return { wrap, adminToken, userToken };
}

describe("createSecureAdminWithMember", () => {
  it("管理者トークンならメンバー付きでハンドラを呼ぶ", async () => {
    const { wrap, adminToken } = await setup();
    const handler = vi.fn(async (_args: unknown, _member: unknown) => OK);
    expect(await wrap(handler)(wrapWithAuth(adminToken, { a: 1 }))).toBe(OK);
    expect(handler).toHaveBeenCalledWith({ a: 1 }, expect.objectContaining({ id: "admin", isAdmin: true }));
  });

  it("トークンなし・一般メンバー・不明トークンは Unauthorized", async () => {
    const { wrap, userToken } = await setup();
    const handler = vi.fn(async (_args: unknown, _member: unknown) => OK);
    const guarded = wrap(handler);
    expect(await guarded({ a: 1 })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await guarded(wrapWithAuth(userToken, { a: 1 }))).toBe(UNAUTHORIZED_RESPONSE);
    expect(await guarded(wrapWithAuth("bogus", { a: 1 }))).toBe(UNAUTHORIZED_RESPONSE);
    expect(handler).not.toHaveBeenCalled();
  });
});
