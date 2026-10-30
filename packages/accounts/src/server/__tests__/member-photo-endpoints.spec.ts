import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { container } from "tsyringe";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  IKeyValueStorageToken,
  ILockToken,
  IPasswordHasherToken,
  ISecretProviderToken,
  IUuidGeneratorToken,
  wrapWithAuth,
} from "@octopus/infrastructures/interfaces";
import { addMember, login, setPassword } from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";
import { ACCOUNTS_ENDPOINTS } from "../accounts-api-contract";
import { UNAUTHORIZED_RESPONSE } from "../secure";

const A = "aaaaaaaaaaaaaaaa";
const photo = "data:image/webp;base64,QUJD";

// GAS / Cloudflare のビルドが宣言するグローバル(`_accounts_<name>`)を、エンドポイントを読み込む前に用意する。
for (const name of ACCOUNTS_ENDPOINTS) (globalThis as Record<string, unknown>)[`_accounts_${name}`] = undefined;
const { ACCOUNTS_HANDLERS } = await import("../endpoints");

let adminToken = "";
let userToken = "";

beforeEach(async () => {
  const storage = new InMemoryKeyValueStorage();
  let n = 0;
  const hasher = { hash: async (password: string, salt: string) => `${salt}|${password}` };
  const generateId = () => `id-${++n}`;
  container.reset();
  container.registerInstance(IKeyValueStorageToken, storage);
  container.registerInstance(IUuidGeneratorToken, { generate: generateId });
  container.registerInstance(IPasswordHasherToken, hasher);
  container.registerInstance(ISecretProviderToken, { get: () => undefined });
  container.registerInstance(ILockToken, { withLock: (_k: string, _t: number, fn: () => unknown) => fn() });
  const deps: AccountsAuthDeps = { storage, generateId, hasher, now: () => Date.now() };
  await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
  await addMember(deps, { id: "user", name: "一般" });
  for (const id of ["admin", "user"]) await setPassword(deps, { id, password: "correct-horse" });
  adminToken = (await login(deps, { id: "admin", password: "correct-horse" })).token;
  userToken = (await login(deps, { id: "user", password: "correct-horse" })).token;
});

const call = (name: keyof typeof ACCOUNTS_HANDLERS, token: string | null, args: unknown) =>
  ACCOUNTS_HANDLERS[name](wrapWithAuth(token, args));

describe("写真エンドポイントの認可", () => {
  it("未ログインは、書き込み・存在確認・読み取りのすべてを拒否される", async () => {
    expect(await call("putMemberPhoto", null, { hash: A, dataUrl: photo })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await call("existsMemberPhotos", null, { hashes: [A] })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await call("getMemberPhotos", null, { hashes: [A] })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await call("getMemberPhotos", "bogus", { hashes: [A] })).toBe(UNAUTHORIZED_RESPONSE);
  });

  it("管理者以外のメンバーは、読み取りだけできる(書き込み・存在確認は拒否)", async () => {
    expect(await call("putMemberPhoto", userToken, { hash: A, dataUrl: photo })).toBe(UNAUTHORIZED_RESPONSE);
    expect(await call("existsMemberPhotos", userToken, { hashes: [A] })).toBe(UNAUTHORIZED_RESPONSE);
    expect(JSON.parse(await call("getMemberPhotos", userToken, { hashes: [A] }))).toEqual({
      status: "success",
      data: { photos: {} },
    });
  });

  it("管理者が書いた写真を、参加者が読み取れる", async () => {
    expect(JSON.parse(await call("putMemberPhoto", adminToken, { hash: A, dataUrl: photo })).status).toBe("success");
    expect(JSON.parse(await call("existsMemberPhotos", adminToken, { hashes: [A] })).data).toEqual({ existing: [A] });
    expect(JSON.parse(await call("getMemberPhotos", userToken, { hashes: [A] })).data).toEqual({ photos: { [A]: photo } });
  });

  it("名簿の一覧(誰でも取れる)には写真のハッシュが含まれる", async () => {
    await call("updateMember", adminToken, { id: "user", name: "一般", photo: A });
    const list = JSON.parse(await call("listMembers", null, {})).data;
    expect(list).toContainEqual({ id: "user", name: "一般", photo: A });
    expect(list.find((m: { id: string }) => m.id === "admin")).toEqual({ id: "admin", name: "管理者" });
  });
});
