import { describe, it, expect, vi } from "vitest";
import { ActionQueue } from "./action-queue";

describe("ActionQueue", () => {
  it("starts empty", () => {
    const queue = new ActionQueue();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
  });

  it("enqueues and dequeues actions in FIFO order", () => {
    const queue = new ActionQueue();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});

    queue.enqueue(first);
    queue.enqueue(second);

    expect(queue.isEmpty()).toBe(false);
    expect(queue.dequeue()).toBe(first);
    expect(queue.dequeue()).toBe(second);
    expect(queue.isEmpty()).toBe(true);
  });

  it("addCycle appends a whole batch of actions at once, preserving order", () => {
    const queue = new ActionQueue();
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    const c = vi.fn(async () => {});
    queue.enqueue(a);

    queue.addCycle([b, c]);

    expect(queue.dequeue()).toBe(a);
    expect(queue.dequeue()).toBe(b);
    expect(queue.dequeue()).toBe(c);
  });

  it("clear empties the queue", () => {
    const queue = new ActionQueue();
    queue.enqueue(vi.fn(async () => {}));
    queue.enqueue(vi.fn(async () => {}));

    queue.clear();

    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
  });
});
