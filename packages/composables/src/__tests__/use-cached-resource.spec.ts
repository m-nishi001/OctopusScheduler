import { describe, it, expect, vi } from "vitest";
import { useCachedResource, type CachedResourceStorage } from "../use-cached-resource";
import { useCachedCollection } from "../use-cached-collection";

function memoryStorage(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const storage: CachedResourceStorage = {
    get: async <T>(id: string) => store.get(id) as T | undefined,
    save: async <T>(id: string, data: T) => {
      store.set(id, data);
    },
  };
  return { storage, store };
}

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useCachedResource", () => {
  it("キャッシュを通信より先に表示し、通信結果で更新・保存する", async () => {
    const { storage, store } = memoryStorage({ k: ["cached"] });
    const d = deferred<string[]>();
    const r = useCachedResource<string[]>({ key: "k", fetcher: () => d.promise, initial: [], storage });

    const loading = r.load();
    await vi.waitFor(() => expect(r.data.value).toEqual(["cached"]));
    expect(r.loading.value).toBe(false);
    expect(r.refreshing.value).toBe(true);

    d.resolve(["fresh"]);
    await loading;
    expect(r.data.value).toEqual(["fresh"]);
    expect(store.get("k")).toEqual(["fresh"]);
    expect(r.refreshing.value).toBe(false);
  });

  it("キャッシュが無い間は loading=true で、通信完了後に false になる", async () => {
    const { storage } = memoryStorage();
    const d = deferred<number>();
    const r = useCachedResource<number>({ key: "k", fetcher: () => d.promise, initial: 0, storage });
    const p = r.load();
    await Promise.resolve();
    expect(r.loading.value).toBe(true);
    d.resolve(5);
    await p;
    expect(r.loading.value).toBe(false);
    expect(r.data.value).toBe(5);
  });

  it("通信が失敗してもキャッシュ表示を保ち error を記録する", async () => {
    const { storage } = memoryStorage({ k: 1 });
    const r = useCachedResource<number>({ key: "k", fetcher: async () => { throw new Error("offline"); }, initial: 0, storage });
    await r.load();
    expect(r.data.value).toBe(1);
    expect(r.error.value?.message).toBe("offline");
    expect(r.loading.value).toBe(false);
  });

  it("通信中の書き込みを古い取得結果で上書きしない", async () => {
    const { storage } = memoryStorage();
    const d = deferred<number[]>();
    const r = useCachedResource<number[]>({ key: "k", fetcher: () => d.promise, initial: [], storage });
    const p = r.refresh();
    await r.set([9]);
    d.resolve([1]);
    await p;
    expect(r.data.value).toEqual([9]);
  });

  it("mutate は先に反映し、commit 失敗時は巻き戻して例外を投げる", async () => {
    const { storage, store } = memoryStorage({ k: [1] });
    const r = useCachedResource<number[]>({ key: "k", fetcher: async () => [1], initial: [], storage });
    await r.load();

    const d = deferred<void>();
    const m = r.mutate((l) => [...l, 2], () => d.promise);
    await vi.waitFor(() => expect(r.data.value).toEqual([1, 2]));
    d.reject(new Error("ng"));
    await expect(m).rejects.toThrow("ng");
    expect(r.data.value).toEqual([1]);
    expect(store.get("k")).toEqual([1]);
  });
});

describe("useCachedCollection", () => {
  it("追加は結果を待って反映、更新/削除は楽観的に反映し失敗時は戻す", async () => {
    const { storage } = memoryStorage();
    const remove = vi.fn().mockRejectedValueOnce(new Error("ng")).mockResolvedValue(undefined);
    const c = useCachedCollection<{ id: string; name: string }>({
      key: "m",
      list: async () => [{ id: "a", name: "A" }],
      add: async (i) => ({ id: i.id ?? "gen", name: i.name }),
      update: async () => undefined,
      remove,
      storage,
    });
    await c.load();
    expect(c.items.value).toHaveLength(1);

    await c.add({ name: "B" });
    expect(c.items.value.map((x) => x.id)).toEqual(["a", "gen"]);

    await c.update({ id: "a", name: "A2" });
    expect(c.items.value[0].name).toBe("A2");

    await expect(c.remove(["a"])).rejects.toThrow("ng");
    expect(c.items.value.map((x) => x.id)).toEqual(["a", "gen"]);
    await c.remove(["a"]);
    expect(c.items.value.map((x) => x.id)).toEqual(["gen"]);
  });
});
