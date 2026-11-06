import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  applyRoster,
  getSession,
  issueLoginKey,
  listAccounts,
  listMembers,
  login,
  setPassword,
} from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";
import { existsMemberPhotos, putMemberPhoto } from "../member-photos";

const A = "aaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbb";

function createDeps(): AccountsAuthDeps {
  let n = 0;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `g-${++n}`,
    hasher: { hash: async (password: string, salt: string) => `${salt}:${password}` },
    now: () => 1_000_000,
  };
}

/** 管理者と、写真・パスワード・受付QR・セッションを持つ参加者を用意する。 */
async function setup() {
  const deps = createDeps();
  await addMember(deps, { id: "root", name: "管理者", isAdmin: true });
  await addMember(deps, { id: "u1", name: "太郎", photo: A });
  await addMember(deps, { id: "u2", name: "次郎", photo: B });
  await addMember(deps, { id: "u3", name: "三郎" });
  await putMemberPhoto(deps, { hash: A, dataUrl: "data:image/webp;base64,QUJD" });
  await putMemberPhoto(deps, { hash: B, dataUrl: "data:image/webp;base64,QUJD" });
  await setPassword(deps, { id: "u1", password: "password-1" });
  await issueLoginKey(deps, { id: "u1" });
  const { token } = await login(deps, { id: "u1", password: "password-1" });
  return { deps, token };
}

describe("applyRoster", () => {
  it("追加・更新と削除を1回で反映し、件数を返す", async () => {
    const { deps } = await setup();
    const result = await applyRoster(deps, { upserts: [{ id: "u3", name: "三郎(改)" }, { id: "n1", name: "新人" }], deleteIds: ["u2"] });
    expect(result).toEqual({ upserted: 2, deleted: 1 });
    expect((await listMembers(deps)).map((m) => [m.id, m.name])).toEqual([
      ["root", "管理者"],
      ["u1", "太郎"],
      ["u3", "三郎(改)"],
      ["n1", "新人"],
    ]);
  });

  it("削除したメンバーの写真・セッション・パスワード・受付QRのキーを片づけ、残る人のものは残す", async () => {
    const { deps, token } = await setup();
    await applyRoster(deps, { upserts: [], deleteIds: ["u1"] });
    expect(await existsMemberPhotos(deps, [A, B])).toEqual({ existing: [B] });
    expect(await getSession(deps, token)).toBeNull();
    await expect(login(deps, { id: "u1", password: "password-1" })).rejects.toThrow();
    expect(await deps.storage.get("accounts-credential/u1")).toBeNull();
    expect(await deps.storage.get("accounts-login-key/u1")).toBeNull();
    expect(await deps.storage.get("accounts-member-sessions/u1")).toBeNull();
  });

  it("管理者を deleteIds に含めると、全体を拒否して名簿を変えない", async () => {
    const { deps } = await setup();
    const before = await listAccounts(deps);
    await expect(applyRoster(deps, { upserts: [{ id: "new", name: "新人" }], deleteIds: ["u2", "root"] })).rejects.toThrow("管理者は削除できません");
    expect(await listAccounts(deps)).toEqual(before);
    expect(await existsMemberPhotos(deps, [A, B])).toEqual({ existing: [A, B] });
  });

  it("ログイン中のメンバー(= 管理者)も削除できない", async () => {
    const { deps } = await setup();
    await setPassword(deps, { id: "root", password: "admin-password" });
    const { token } = await login(deps, { id: "root", password: "admin-password" });
    const me = await getSession(deps, token);
    await expect(applyRoster(deps, { upserts: [], deleteIds: [me!.id] })).rejects.toThrow();
    expect(await getSession(deps, token)).not.toBeNull();
  });

  it("同じ ID を追加・更新と削除の両方に指定すると拒否する。無い ID の削除は無視する", async () => {
    const { deps } = await setup();
    await expect(applyRoster(deps, { upserts: [{ id: "u3", name: "x" }], deleteIds: ["u3"] })).rejects.toThrow();
    await expect(applyRoster(deps, { upserts: [], deleteIds: ["missing"] })).resolves.toEqual({ upserted: 0, deleted: 0 });
  });

  it("写真を差し替えた人の古い写真は消え、削除と差し替えが同じ写真を指していても整合する", async () => {
    const { deps } = await setup();
    await applyRoster(deps, { upserts: [{ id: "u1", name: "太郎", photo: B }], deleteIds: ["u2"] });
    expect(await existsMemberPhotos(deps, [A, B])).toEqual({ existing: [B] });
  });
});
