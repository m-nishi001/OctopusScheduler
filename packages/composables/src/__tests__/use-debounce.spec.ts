import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDebouncedCallback } from "../use-debounce";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses rapid trigger() calls into a single fn() invocation after quiescence", () => {
    const fn = vi.fn();
    const { trigger } = useDebouncedCallback(fn, 1000);

    trigger();
    vi.advanceTimersByTime(400);
    trigger();
    vi.advanceTimersByTime(400);
    trigger();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() runs the pending call immediately and cancels the timer", () => {
    const fn = vi.fn();
    const { trigger, flush } = useDebouncedCallback(fn, 1000);

    trigger();
    flush();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op when nothing is pending", () => {
    const fn = vi.fn();
    const { flush } = useDebouncedCallback(fn, 1000);

    flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() discards a pending call", () => {
    const fn = vi.fn();
    const { trigger, cancel } = useDebouncedCallback(fn, 1000);

    trigger();
    cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
