import { describe, it, expect, vi } from "vitest";
import { NextCycleSlot } from "./next-cycle-slot";

/** 外から解決できる Promise。用意の「途中」を作るため。 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("NextCycleSlot", () => {
  it("最初は idle で、受け取れるものは無い", async () => {
    const slot = new NextCycleSlot<string>();
    expect(slot.state.kind).toBe("idle");
    expect(await slot.take()).toBeNull();
  });

  it("用意が済んだら ready になり、受け取ると idle に戻る(二重に受け取れない)", async () => {
    const slot = new NextCycleSlot<string>();
    slot.start("d1", async () => "cycle");
    expect(slot.state.kind).toBe("preparing");
    expect(await slot.take()).toBe("cycle");
    expect(slot.state.kind).toBe("idle");
    expect(await slot.take()).toBeNull();
  });

  it("用意の途中で受け取ると、出来上がるのを待って受け取る", async () => {
    const slot = new NextCycleSlot<string>();
    const d = deferred<string>();
    slot.start("d1", () => d.promise);
    const taken = slot.take();
    d.resolve("late");
    expect(await taken).toBe("late");
  });

  it("同じ key で始め直しても、用意は1回だけ", async () => {
    const slot = new NextCycleSlot<string>();
    const task = vi.fn(async () => "x");
    slot.start("d1", task);
    slot.start("d1", task);
    await slot.take();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("失敗したら failed になり、受け取りは null(その場で用意し直す合図)。onError に伝わる", async () => {
    const onError = vi.fn();
    const slot = new NextCycleSlot<string>({ onError });
    slot.start("d1", async () => {
      throw new Error("boom");
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(slot.state.kind).toBe("failed");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    expect(await slot.take()).toBeNull();
    expect(slot.state.kind).toBe("idle");
  });

  it("失敗した key では、受け取るまでやり直さない。受け取った後は同じ key でも始め直せる", async () => {
    const slot = new NextCycleSlot<string>();
    const task = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("again");
    slot.start("d1", task);
    await Promise.resolve();
    await Promise.resolve();
    slot.start("d1", task);
    expect(task).toHaveBeenCalledTimes(1);
    expect(await slot.take()).toBeNull();
    slot.start("d1", task);
    expect(await slot.take()).toBe("again");
  });

  it("用意済みのものを無効化すると、後始末(onDiscard)して idle に戻る", async () => {
    const onDiscard = vi.fn();
    const slot = new NextCycleSlot<string>({ onDiscard });
    slot.start("d1", async () => "ready-value");
    await Promise.resolve();
    await Promise.resolve();
    expect(slot.state.kind).toBe("ready");
    slot.invalidate();
    expect(onDiscard).toHaveBeenCalledWith("ready-value");
    expect(slot.state.kind).toBe("idle");
    expect(await slot.take()).toBeNull();
  });

  it("用意の最中に無効化すると、出来上がっても使わず、後始末する(待っていた受け取りは null)", async () => {
    const onDiscard = vi.fn();
    const slot = new NextCycleSlot<string>({ onDiscard });
    const d = deferred<string>();
    slot.start("d1", () => d.promise);
    const taken = slot.take();
    slot.invalidate();
    d.resolve("stale");
    expect(await taken).toBeNull();
    expect(onDiscard).toHaveBeenCalledWith("stale");
    expect(slot.state.kind).toBe("idle");
  });

  it("用意の最中に無効化されたあとの失敗は、状態を汚さない", async () => {
    const onError = vi.fn();
    const slot = new NextCycleSlot<string>({ onError });
    const d = deferred<string>();
    slot.start("d1", () => d.promise);
    slot.invalidate();
    d.reject(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(slot.state.kind).toBe("idle");
    expect(onError).not.toHaveBeenCalled();
  });

  it("別の key で始めると、前の用意は無効化される(古い抽選のあとの用意を使わない)", async () => {
    const onDiscard = vi.fn();
    const slot = new NextCycleSlot<string>({ onDiscard });
    slot.start("d1", async () => "first");
    await Promise.resolve();
    await Promise.resolve();
    slot.start("d2", async () => "second");
    expect(onDiscard).toHaveBeenCalledWith("first");
    expect(await slot.take()).toBe("second");
  });
});
