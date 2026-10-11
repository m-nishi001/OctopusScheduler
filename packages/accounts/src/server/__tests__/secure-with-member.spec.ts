import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { wrapWithAuth } from "@octopus/infrastructures/interfaces";
import { addMember, login, logout, setPassword } from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";
import { createSecureAdminWithMember, createSecureMember, UNAUTHORIZED_RESPONSE } from "../secure";

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
  const secureDeps = { getStorage: () => storage, now: () => 1000 };
  const wrap = createSecureAdminWithMember(secureDeps);
  const wrapMember = createSecureMember(secureDeps);
  return { wrap, wrapMember, adminToken, userToken, storage };
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

describe("createSecureMember", () => {
  it("管理者でも一般メンバー(参加者)でも、有効なトークンならメンバー付きでハンドラを呼ぶ", async () => {
    const { wrapMember, adminToken, userToken } = await setup();
    const handler = vi.fn(async (_args: unknown, _member: unknown) => OK);
    expect(await wrapMember(handler)(wrapWithAuth(userToken, { a: 1 }))).toBe(OK);
    expect(handler).toHaveBeenLastCalledWith({ a: 1 }, expect.objectContaining({ id: "user" }));
    expect(await wrapMember(handler)(wrapWithAuth(adminToken, { a: 2 }))).toBe(OK);
    expect(handler).toHaveBeenLastCalledWith({ a: 2 }, expect.objectContaining({ id: "admin", isAdmin: true }));
  });

  it("トークンなし・不明なトークンは Unauthorized でハンドラを呼ばない", async () => {
    const { wrapMember } = await setup();
    const handler = vi.fn(async (_args: unknown, _member: unknown) => OK);
    expect(await wrapMember(handler)({ x: 1 })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await wrapMember(handler)(wrapWithAuth("unknown-token", {}))).toBe(UNAUTHORIZED_RESPONSE);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ログアウト済みのトークンは使えない", async () => {
    const { wrapMember, userToken, storage } = await setup();
    const handler = vi.fn(async (_args: unknown, _member: unknown) => OK);
    expect(await wrapMember(handler)(wrapWithAuth(userToken, {}))).toBe(OK);
    await logout({ storage, generateId: () => "x" }, userToken);
    expect(await wrapMember(handler)(wrapWithAuth(userToken, {}))).toBe(UNAUTHORIZED_RESPONSE);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
