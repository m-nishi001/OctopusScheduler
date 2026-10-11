import { describe, expect, it, vi } from "vitest";
import { MemberPhotoCache } from "./member-photo-cache";
import type { MemberPhotoSource } from "./member-photo-cache";

function source(overrides: Partial<MemberPhotoSource> = {}) {
  let n = 0;
  const base = {
    listMembers: vi.fn(async () => [
      { id: "alice", photoAssetId: "asset-a" },
      { id: "bob", photoAssetId: "asset-b" },
      { id: "carol" },
    ]),
    getAsset: vi.fn(async (id: string) => ({ blob: new Blob([id]) })),
    createUrl: vi.fn(() => `blob:photo-${++n}`),
    revokeUrl: vi.fn(),
  };
  return { ...base, ...overrides } as MemberPhotoSource & typeof base;
}

describe("MemberPhotoCache", () => {
  it("写真のあるメンバーはURLを返し、写真が無いメンバーは undefined", async () => {
    const cache = new MemberPhotoCache(source());
    await cache.ensure(["alice", "carol"]);
    expect(cache.get("alice")).toBe("blob:photo-1");
    expect(cache.get("carol")).toBeUndefined();
    expect(cache.get("unknown")).toBeUndefined();
  });

  it("読み込み済みのメンバーは取り直さない。メンバー一覧は使い回す", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    await cache.ensure(["alice"]);
    await cache.ensure(["alice"]);
    await cache.ensure(["bob"]);
    expect(src.listMembers).toHaveBeenCalledTimes(1);
    expect(src.getAsset).toHaveBeenCalledTimes(2);
    expect(cache.get("bob")).toBe("blob:photo-2");
  });

  it("名簿に無いメンバーが来たら、名簿を読み直す（名簿が増えた場合）", async () => {
    const members = [{ id: "alice", photoAssetId: "asset-a" }] as Array<{ id: string; photoAssetId?: string }>;
    const src = source({ listMembers: vi.fn(async () => [...members]) });
    const cache = new MemberPhotoCache(src);
    await cache.ensure(["alice"]);
    members.push({ id: "dave", photoAssetId: "asset-d" });
    await cache.ensure(["dave"]);
    expect(src.listMembers).toHaveBeenCalledTimes(2);
    expect(cache.get("dave")).toBeDefined();
  });

  it("同時に呼んでも、各メンバーの写真は1回だけ読み込む", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    await Promise.all([cache.ensure(["alice", "bob"]), cache.ensure(["alice", "bob"]), cache.ensure(["bob"])]);
    expect(src.getAsset).toHaveBeenCalledTimes(2);
    expect(src.createUrl).toHaveBeenCalledTimes(2);
    expect(cache.get("alice")).toBeDefined();
    expect(cache.get("bob")).toBeDefined();
  });

  it("アセットが読めない・中身が無いときは写真なし。他のメンバーには影響しない", async () => {
    const src = source({
      getAsset: vi.fn(async (id: string) => {
        if (id === "asset-a") throw new Error("broken");
        return { blob: new Blob([id]) };
      }),
    });
    const cache = new MemberPhotoCache(src);
    await cache.ensure(["alice", "bob"]);
    expect(cache.get("alice")).toBeUndefined();
    expect(cache.get("bob")).toBeDefined();
  });

  it("メンバー一覧が読めないときは何も確定せず、次の呼び出しで再試行できる", async () => {
    let fail = true;
    const src = source({
      listMembers: vi.fn(async () => {
        if (fail) throw new Error("offline");
        return [{ id: "alice", photoAssetId: "asset-a" }];
      }),
    });
    const cache = new MemberPhotoCache(src);
    await cache.ensure(["alice"]);
    expect(cache.get("alice")).toBeUndefined();
    fail = false;
    await cache.ensure(["alice"]);
    expect(cache.get("alice")).toBeDefined();
  });

  it("dispose で作ったURLを解放し、空に戻る", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    await cache.ensure(["alice", "bob", "carol"]);
    cache.dispose();
    expect(src.revokeUrl).toHaveBeenCalledTimes(2);
    expect(cache.get("alice")).toBeUndefined();
  });
});
