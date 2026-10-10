import { describe, expect, it, vi } from "vitest";
import { ActionQueue, labeled } from "./action-queue";

describe("ActionQueue のラベル", () => {
  it("labeled は元の処理を呼び、ラベルを持つ", async () => {
    const fn = vi.fn(async () => {});
    const action = labeled("stopMemberDraw", fn);
    expect(action.label).toBe("stopMemberDraw");
    await action();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("peekLabel は次のステップのラベルを返し、取り出さない。ラベル無しや空キューは undefined", () => {
    const queue = new ActionQueue();
    expect(queue.peekLabel()).toBeUndefined();
    queue.enqueue(async () => {});
    queue.enqueue(labeled("stopPrizeDraw", async () => {}));
    expect(queue.peekLabel()).toBeUndefined();
    queue.dequeue();
    expect(queue.peekLabel()).toBe("stopPrizeDraw");
    expect(queue.actions).toHaveLength(1);
  });

  it("onDequeue は取り出す直前に、そのステップのラベルで呼ばれる(取り出せないときは呼ばれない)", () => {
    const queue = new ActionQueue();
    const seen: Array<string | undefined> = [];
    queue.onDequeue = (label) => seen.push(label);
    expect(queue.dequeue()).toBeUndefined();
    queue.enqueue(labeled("a", async () => {}));
    queue.enqueue(async () => {});
    queue.dequeue();
    queue.dequeue();
    expect(seen).toEqual(["a", undefined]);
  });

  it("addCycle でもラベルは保たれる", () => {
    const queue = new ActionQueue();
    queue.addCycle([labeled("x", async () => {}), labeled("y", async () => {})]);
    expect(queue.actions.map((a) => a.label)).toEqual(["x", "y"]);
  });
});
