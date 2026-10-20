import { describe, expect, it, vi } from "vitest";
import { useBusy } from "../use-busy";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useBusy", () => {
  it("実行中は busy にキーが入り、終わると null に戻る。成功なら true", async () => {
    const { busy, run } = useBusy<string>(vi.fn());
    const task = deferred();
    const result = run("a", () => task.promise);
    expect(busy.value).toBe("a");
    task.resolve();
    expect(await result).toBe(true);
    expect(busy.value).toBeNull();
  });

  it("実行中にもう一度呼ばれたら、実行せず false(連打しても1回だけ)", async () => {
    const { busy, run } = useBusy<string>(vi.fn());
    const first = deferred();
    const firstTask = vi.fn(() => first.promise);
    const secondTask = vi.fn(async () => {});
    const firstResult = run("a", firstTask);
    expect(await run("b", secondTask)).toBe(false);
    expect(secondTask).not.toHaveBeenCalled();
    expect(busy.value).toBe("a");
    first.resolve();
    await firstResult;
    // 終わったあとは、また実行できる
    expect(await run("b", secondTask)).toBe(true);
    expect(secondTask).toHaveBeenCalledOnce();
  });

  it("失敗したら onError に渡して false を返し、例外は外に出さない。busy は必ず戻る", async () => {
    const onError = vi.fn();
    const { busy, run } = useBusy<string>(onError);
    const boom = new Error("boom");
    expect(await run("a", async () => { throw boom; })).toBe(false);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(busy.value).toBeNull();
    expect(await run("a", async () => {})).toBe(true);
  });

  it("同期的に投げる処理でも同じ(onError に渡し、busy は戻る)", async () => {
    const onError = vi.fn();
    const { busy, run } = useBusy<string>(onError);
    expect(await run("a", () => { throw new Error("sync"); })).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(busy.value).toBeNull();
  });

  it("別々の useBusy は互いに止めない", async () => {
    const a = useBusy<string>(vi.fn());
    const b = useBusy<string>(vi.fn());
    const task = deferred();
    const pending = a.run("x", () => task.promise);
    expect(await b.run("y", async () => {})).toBe(true);
    task.resolve();
    await pending;
  });
});
