import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  deleteMemberPhotos,
  existsMemberPhotos,
  getMemberPhotos,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_READ,
  putMemberPhoto,
} from "../member-photos";
import { addMember, deleteMember, applyRoster, updateMember } from "../accounts-use-cases";
import type { AccountsUseCaseDeps } from "../accounts-use-cases";

const A = "aaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbb";
const dataUrl = (payload = "AAAA", mime = "image/webp") => `data:${mime};base64,${payload}`;

function deps(): AccountsUseCaseDeps {
  let n = 0;
  return { storage: new InMemoryKeyValueStorage(), generateId: () => `g-${++n}` };
}

describe("member-photos: 保存と取得", () => {
  it("保存した写真をデータURLで取れ、存在確認もできる", async () => {
    const d = deps();
    await putMemberPhoto(d, { hash: A, dataUrl: dataUrl("QUJD") });
    expect((await getMemberPhotos(d, [A, B])).photos).toEqual({ [A]: dataUrl("QUJD") });
    expect(await existsMemberPhotos(d, [A, B])).toEqual({ existing: [A] });
  });

  it("同じハッシュを送り直すと上書きで、1枚のまま(冪等)", async () => {
    const d = deps();
    await putMemberPhoto(d, { hash: A, dataUrl: dataUrl("QUJD") });
    await putMemberPhoto(d, { hash: A, dataUrl: dataUrl("QUJD") });
    expect(await d.storage.listByPrefix("accounts/assets/")).toHaveLength(1);
  });

  it("画像でないもの・形式の違うデータURL・大きすぎる画像・不正なハッシュは拒否する", async () => {
    const d = deps();
    await expect(putMemberPhoto(d, { hash: A, dataUrl: dataUrl("QUJD", "text/html") })).rejects.toThrow();
    await expect(putMemberPhoto(d, { hash: A, dataUrl: dataUrl("QUJD", "image/svg") })).rejects.toThrow();
    await expect(putMemberPhoto(d, { hash: A, dataUrl: "QUJD" })).rejects.toThrow();
    await expect(putMemberPhoto(d, { hash: "../x", dataUrl: dataUrl() })).rejects.toThrow("Invalid photo hash");
    const tooBig = "A".repeat(Math.ceil(((MAX_PHOTO_BYTES + 3) / 3) * 4));
    await expect(putMemberPhoto(d, { hash: A, dataUrl: dataUrl(tooBig) })).rejects.toThrow("too large");
    expect(await d.storage.listByPrefix("accounts/assets/")).toHaveLength(0);
  });

  it("まとめて取れるのは最大枚数まで", async () => {
    const d = deps();
    const hashes = Array.from({ length: MAX_PHOTOS_PER_READ + 1 }, (_, i) => i.toString(16).padStart(16, "0"));
    await expect(getMemberPhotos(d, hashes)).rejects.toThrow("Too many");
    expect((await getMemberPhotos(d, hashes.slice(0, MAX_PHOTOS_PER_READ))).photos).toEqual({});
  });

  it("deleteMemberPhotos は保存済みのものを消し、無いものは何もしない", async () => {
    const d = deps();
    await putMemberPhoto(d, { hash: A, dataUrl: dataUrl() });
    await deleteMemberPhotos(d, [A, B]);
    expect((await existsMemberPhotos(d, [A])).existing).toEqual([]);
  });
});

describe("名簿の変更に伴う孤児写真の削除", () => {
  async function withPhotos() {
    const d = deps();
    await putMemberPhoto(d, { hash: A, dataUrl: dataUrl() });
    await putMemberPhoto(d, { hash: B, dataUrl: dataUrl() });
    await addMember(d, { id: "u1", name: "太郎", photo: A });
    return d;
  }
  const existing = async (d: AccountsUseCaseDeps) => (await existsMemberPhotos(d, [A, B])).existing;

  it("写真を差し替えると古い写真のファイルが消える", async () => {
    const d = await withPhotos();
    await updateMember(d, { id: "u1", name: "太郎", photo: B });
    expect(await existing(d)).toEqual([B]);
  });

  it("写真を省略した更新では、写真のファイルも名簿の参照も残る", async () => {
    const d = await withPhotos();
    await updateMember(d, { id: "u1", name: "太郎2" });
    expect(await existing(d)).toEqual([A, B]);
  });

  it("メンバーを削除すると写真のファイルも消える", async () => {
    const d = await withPhotos();
    await deleteMember(d, "u1");
    expect(await existing(d)).toEqual([B]);
  });

  it("一括反映で写真を差し替えると古い写真が消え、反映に含まれないメンバーの写真は残る", async () => {
    const d = await withPhotos();
    await addMember(d, { id: "u2", name: "花子", photo: B });
    await applyRoster(d, { upserts: [{ id: "u1", name: "太郎", photo: B }], deleteIds: [] });
    expect(await existing(d)).toEqual([B]);
  });
});
