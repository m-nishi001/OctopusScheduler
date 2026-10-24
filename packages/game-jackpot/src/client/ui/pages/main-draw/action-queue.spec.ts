import { describe, it, expect, vi } from "vitest";
import { ActionQueue, pause, step } from "./action-queue";

describe("step / pause", () => {
  it("step は元の処理を呼び、ラベルを持つ", async () => {
    const fn = vi.fn(async () => {});
    const s = step(fn, "stopMemberDraw");
    expect(s.label).toBe("stopMemberDraw");
    expect(s.pause).toBeUndefined();
    await s.run();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("pause は待ってから次のEnterを待つステップ", async () => {
    vi.useFakeTimers();
    const s = pause(2);
    expect(s.pause).toBe(true);
    const done = vi.fn();
    void s.run().then(done);
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("pause の待ち方の差し替え", () => {
  it("渡した wait で待つ(実際には待たない)。秒数がそのまま渡る", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const s = pause(0.5, wait);
    expect(s.pause).toBe(true);
    await s.run();
    expect(wait).toHaveBeenCalledWith(0.5);
  });

  it("wait を渡さなければ実際に待つ。秒数を省くと1秒", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    void pause().run().then(done);
    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("ActionQueue", () => {
  const noop = async () => {};

  it("空から始まり、サイクルを順番どおりに取り出す", () => {
    const queue = new ActionQueue();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeUndefined();

    const a = step(noop);
    const b = step(noop);
    const c = step(noop);
    queue.addCycle([a, b]);
    queue.addCycle([c]);

    expect(queue.isEmpty()).toBe(false);
    expect([queue.dequeue(), queue.dequeue(), queue.dequeue()]).toEqual([a, b, c]);
    expect(queue.isEmpty()).toBe(true);
  });

  it("peekLabel は次のステップのラベルを返し、取り出さない。ラベル無しや空キューは undefined", () => {
    const queue = new ActionQueue();
    expect(queue.peekLabel()).toBeUndefined();
    queue.addCycle([step(noop), step(noop, "stopPrizeDraw")]);
    expect(queue.peekLabel()).toBeUndefined();
    queue.dequeue();
    expect(queue.peekLabel()).toBe("stopPrizeDraw");
    expect(queue.peekLabel()).toBe("stopPrizeDraw");
  });

  it("onDequeue は取り出す直前に、そのステップのラベルで呼ばれる(取り出せないときは呼ばれない)", () => {
    const queue = new ActionQueue();
    const seen: Array<string | undefined> = [];
    queue.onDequeue = (label) => seen.push(label);
    expect(queue.dequeue()).toBeUndefined();
    queue.addCycle([step(noop, "a"), step(noop)]);
    queue.dequeue();
    queue.dequeue();
    expect(seen).toEqual(["a", undefined]);
  });
});
