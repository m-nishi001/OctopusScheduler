/* @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import createInputController from "../input-controller";

describe("input-controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("supports long-press: initial trigger then repeated triggers every minInterval while held", () => {
    const ic = createInputController({ minIntervalMs: 1000 });
    const spy = vi.fn();
    ic.setOnTrigger(spy);
    ic.attach();

    // first keydown should trigger immediately
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(spy).toHaveBeenCalledTimes(1);

    // repeated keydown event while held is ignored (pressed flag prevents duplicate keydown handling)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(spy).toHaveBeenCalledTimes(1);

    // advance time by minInterval: the repeat timer should fire once
    vi.advanceTimersByTime(1000);
    vi.setSystemTime(1000);
    expect(spy).toHaveBeenCalledTimes(2);

    // advance another interval, another repeat
    vi.advanceTimersByTime(1000);
    vi.setSystemTime(2000);
    expect(spy).toHaveBeenCalledTimes(3);

    // now release the key and ensure no more triggers
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    vi.advanceTimersByTime(2000);
    vi.setSystemTime(4000);
    expect(spy).toHaveBeenCalledTimes(3);

    ic.detach();
  });

  it("detach removes listeners", () => {
    const ic = createInputController({ minIntervalMs: 1000 });
    const spy = vi.fn();
    ic.setOnTrigger(spy);
    ic.attach();
    ic.detach();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(spy).toHaveBeenCalledTimes(0);
  });
});
