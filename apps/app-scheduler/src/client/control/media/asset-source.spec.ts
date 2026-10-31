import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AssetSource, PREFETCH_CONCURRENCY } from "./asset-source";

const blob = (text: string, type = "image/png") => new Blob([text], { type });

/** 外から解決できる Promise。 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(local: Record<string, Blob> = {}) {
  const store = { ...local };
  const repository = {
    getAssetById: vi.fn(async (id: string) => (store[id] ? { id, blob: store[id] } : null)),
    pullRemote: vi.fn(async (id: string) => {
      store[id] = blob(`remote-${id}`);
      return { id, blob: store[id] };
    }),
  };
  return { repository, source: new AssetSource(repository as never), store };
}

describe("AssetSource.ensure", () => {
  it("手元にあれば、サーバーへは行かずにそれを返す", async () => {
    const mine = blob("mine");
    const { source, repository } = setup({ a: mine });
    expect(await source.ensure("a")).toBe(mine);
    expect(repository.pullRemote).not.toHaveBeenCalled();
  });

  it("手元に無ければサーバーから取って返し、次からは手元のものを使う", async () => {
    const { source, repository } = setup();
    const first = await source.ensure("a");
    expect(first.size).toBe("remote-a".length);
    expect(await source.ensure("a")).toBe(first);
    expect(repository.pullRemote).toHaveBeenCalledOnce();
  });

  it("中身が空の素材は、取れていないものとして取り直す", async () => {
    const { source, repository } = setup({ a: new Blob([]) });
    expect((await source.ensure("a")).size).toBe("remote-a".length);
    expect(repository.pullRemote).toHaveBeenCalledOnce();
  });

  it("同時に呼んでも、取りに行くのは1回だけ", async () => {
    const { source, repository, store } = setup();
    const gate = deferred<void>();
    repository.pullRemote.mockImplementation(async (id: string) => {
      await gate.promise;
      store[id] = blob("x");
      return { id, blob: store[id] };
    });
    const first = source.ensure("a");
    const second = source.ensure("a");
    gate.resolve();
    expect(await first).toBe(await second);
    expect(repository.pullRemote).toHaveBeenCalledOnce();
  });

  it("失敗しても、次の呼び出しでもう一度取る", async () => {
    const { source, repository } = setup();
    repository.pullRemote.mockRejectedValueOnce(new Error("offline"));
    await expect(source.ensure("a")).rejects.toThrow("offline");
    expect((await source.ensure("a")).size).toBe("remote-a".length);
    expect(repository.pullRemote).toHaveBeenCalledTimes(2);
  });

  it("サーバーの一覧で分かっている fileId を渡す", async () => {
    const { source, repository } = setup();
    await source.ensure("a", "folder/a_name");
    expect(repository.pullRemote).toHaveBeenCalledWith("a", "folder/a_name");
  });
});

describe("AssetSource.prefetchAll", () => {
  it("小さい素材から、同時に PREFETCH_CONCURRENCY 件ずつ取る", async () => {
    const { source, repository, store } = setup();
    const gates = new Map<string, ReturnType<typeof deferred<void>>>();
    const started: string[] = [];
    repository.pullRemote.mockImplementation(async (id: string) => {
      started.push(id);
      const gate = deferred<void>();
      gates.set(id, gate);
      await gate.promise;
      store[id] = blob(id);
      return { id, blob: store[id] };
    });
    const items = [
      { id: "big", size: 900 },
      { id: "s1", size: 1 },
      { id: "s3", size: 3 },
      { id: "s2", size: 2 },
      { id: "unknown" },
    ];
    const done = source.prefetchAll(items);
    await vi.waitFor(() => expect(started).toHaveLength(PREFETCH_CONCURRENCY));
    expect(started).toEqual(["s1", "s2", "s3"]);
    gates.get("s1")!.resolve();
    await vi.waitFor(() => expect(started).toHaveLength(4));
    expect(started[3]).toBe("big");
    for (const id of ["s2", "s3"]) gates.get(id)!.resolve();
    await vi.waitFor(() => expect(started).toHaveLength(5));
    for (const gate of gates.values()) gate.resolve();
    await done;
    expect(started).toEqual(["s1", "s2", "s3", "big", "unknown"]);
  });

  it("1件の失敗では止まらず、ほかを取り終える", async () => {
    const { source, repository, store } = setup();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    repository.pullRemote.mockImplementation(async (id: string) => {
      if (id === "bad") throw new Error("boom");
      store[id] = blob(id);
      return { id, blob: store[id] };
    });
    await source.prefetchAll([{ id: "bad", size: 1 }, { id: "ok", size: 2 }]);
    expect(repository.pullRemote).toHaveBeenCalledTimes(2);
  });

  it("指示で ensure した素材は、先読みの列を待たずにすぐ取りに行く", async () => {
    const { source, repository, store } = setup();
    const started: string[] = [];
    const gate = deferred<void>();
    repository.pullRemote.mockImplementation(async (id: string) => {
      started.push(id);
      await gate.promise;
      store[id] = blob(id);
      return { id, blob: store[id] };
    });
    const ids = ["p1", "p2", "p3", "p4", "p5"];
    const done = source.prefetchAll(ids.map((id, i) => ({ id, size: i })));
    await vi.waitFor(() => expect(started).toEqual(["p1", "p2", "p3"]));
    const wanted = source.ensure("p5");
    await vi.waitFor(() => expect(started).toContain("p5"));
    expect(started).not.toContain("p4");
    gate.resolve();
    await wanted;
    await done;
    expect(repository.pullRemote.mock.calls.filter(([id]) => id === "p5")).toHaveLength(1);
  });
});
