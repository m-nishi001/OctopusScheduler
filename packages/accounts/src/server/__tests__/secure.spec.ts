import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { wrapWithAuth } from "@octopus/infrastructures/interfaces";
import { addMember, login, setPassword } from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";
import { createSecure, UNAUTHORIZED_RESPONSE } from "../secure";

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
  const secure = createSecure({ getStorage: () => storage, now: () => 1000 });
  return { secure, adminToken, userToken };
}

describe("secure", () => {
  it("rejects admin endpoints without a token, with a non-admin token and with an unknown token", async () => {
    const { secure, userToken } = await setup();
    const handler = vi.fn(async (_args?: unknown) => OK);
    const guarded = secure("admin", handler);
    expect(await guarded({ a: 1 })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await guarded(wrapWithAuth(userToken, { a: 1 }))).toBe(UNAUTHORIZED_RESPONSE);
    expect(await guarded(wrapWithAuth("bogus", { a: 1 }))).toBe(UNAUTHORIZED_RESPONSE);
    expect(handler).not.toHaveBeenCalled();
  });

  it("lets an admin token through and passes the unwrapped args to the handler", async () => {
    const { secure, adminToken } = await setup();
    const handler = vi.fn(async (_args?: unknown) => OK);
    expect(await secure("admin", handler)(wrapWithAuth(adminToken, { a: 1 }))).toBe(OK);
    expect(handler).toHaveBeenCalledWith({ a: 1 });
  });

  it("works for string and missing args (not only objects)", async () => {
    const { secure, adminToken } = await setup();
    const handler = vi.fn(async (_args?: unknown) => OK);
    const guarded = secure("admin", handler);
    await guarded(wrapWithAuth(adminToken, "screen-name"));
    await guarded(wrapWithAuth(adminToken, undefined));
    expect(handler).toHaveBeenNthCalledWith(1, "screen-name");
    expect(handler).toHaveBeenNthCalledWith(2, undefined);
  });

  it("leaves public endpoints open, with or without a token", async () => {
    const { secure, adminToken } = await setup();
    const handler = vi.fn(async (_args?: unknown) => OK);
    const open = secure("public", handler);
    expect(await open({ a: 1 })).toBe(OK);
    expect(await open(wrapWithAuth(adminToken, { a: 1 }))).toBe(OK);
    expect(handler).toHaveBeenLastCalledWith({ a: 1 });
  });

  it("marks the unauthorized response as non-retryable", () => {
    expect(JSON.parse(UNAUTHORIZED_RESPONSE)).toEqual({
      status: "error",
      message: "Unauthorized",
      retryable: false,
    });
  });
});
