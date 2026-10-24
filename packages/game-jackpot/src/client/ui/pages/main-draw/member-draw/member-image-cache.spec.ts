import { describe, it, expect, vi } from "vitest";
import { MemberImageCache, createAssetImageLoader } from "./member-image-cache";

function deferred() {
  let resolve!: (v: string | null) => void;
  const promise = new Promise<string | null>((r) => (resolve = r));
  return { promise, resolve };
}

describe("MemberImageCache", () => {
  it("読み込んだ URL を返し、読み込み済みのものは読み直さない(別の画面でも使い回せる)", async () => {
    const load = vi.fn(async (id: string) => `blob:${id}`);
    const cache = new MemberImageCache(load);
    await cache.preload(["a", "b"]);
    expect(cache.get("a")).toBe("blob:a");
    await cache.preload(["a", "b", "c"]);
    expect(load.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(cache.size).toBe(3);
  });

  it("空・重複は無視する", async () => {
    const load = vi.fn(async (id: string) => `u:${id}`);
    const cache = new MemberImageCache(load);
    await cache.preload([undefined, null, "", "a", "a"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("並列に読み込む(1件ずつ待たない)が、同時に読むのは上限まで", async () => {
    const pending = new Map<string, ReturnType<typeof deferred>>();
    let active = 0;
    let peak = 0;
    const load = vi.fn((id: string) => {
      active++;
      peak = Math.max(peak, active);
      const d = deferred();
      pending.set(id, d);
      return d.promise.finally(() => active--);
    });
    const cache = new MemberImageCache(load, 3);
    const done = cache.preload(["a", "b", "c", "d", "e"]);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(3); // 3件が同時に走り、残りは待つ
    pending.get("a")!.resolve("ua");
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    for (const id of ["b", "c", "d"]) {
      await vi.waitFor(() => expect(pending.has(id)).toBe(true));
      pending.get(id)!.resolve(`u${id}`);
    }
    await vi.waitFor(() => expect(pending.has("e")).toBe(true));
    pending.get("e")!.resolve("ue");
    await done;
    expect(peak).toBe(3);
    expect(cache.get("e")).toBe("ue");
  });

  it("同じ画像を同時に頼まれても、読み込みは1回", async () => {
    const d = deferred();
    const load = vi.fn(() => d.promise);
    const cache = new MemberImageCache(load);
    const p1 = cache.preload(["a"]);
    const p2 = cache.preload(["a"]);
    d.resolve("u");
    await Promise.all([p1, p2]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.get("a")).toBe("u");
  });

  it("読めなかった画像は黙って飛ばし、ほかは読み込む。次の機会にまた読む", async () => {
    const load = vi.fn(async (id: string) => {
      if (id === "bad") throw new Error("io");
      if (id === "none") return null;
      return `u:${id}`;
    });
    const cache = new MemberImageCache(load);
    await cache.preload(["bad", "none", "ok"]);
    expect(cache.get("ok")).toBe("u:ok");
    expect(cache.get("bad")).toBeUndefined();
    await cache.preload(["bad"]);
    expect(load.mock.calls.filter((c) => c[0] === "bad")).toHaveLength(2);
  });

  it("clear で URL を破棄して空にする", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const cache = new MemberImageCache(async (id) => `blob:${id}`);
    await cache.preload(["a", "b"]);
    cache.clear();
    expect(revoke).toHaveBeenCalledWith("blob:a");
    expect(revoke).toHaveBeenCalledWith("blob:b");
    expect(cache.size).toBe(0);
    revoke.mockRestore();
  });
});

describe("createAssetImageLoader", () => {
  it("blob は object URL に、dataUrl・url はそのまま、無ければ null", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:made");
    const assets = {
      getAssetDataById: vi.fn(async (id: string) =>
        id === "blob" ? { blob: new Blob(["x"]) } : id === "data" ? { dataUrl: "data:x" } : id === "url" ? { url: "http://x" } : id === "empty" ? {} : null
      ),
    } as never;
    const load = createAssetImageLoader(assets);
    expect(await load("blob")).toBe("blob:made");
    expect(await load("data")).toBe("data:x");
    expect(await load("url")).toBe("http://x");
    expect(await load("empty")).toBeNull();
    expect(await load("missing")).toBeNull();
    create.mockRestore();
  });
});
