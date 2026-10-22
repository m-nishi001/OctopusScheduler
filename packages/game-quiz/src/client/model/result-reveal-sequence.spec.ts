import { describe, expect, it, vi } from "vitest";
import { runResultRevealSequence } from "./result-reveal-sequence";

function steps(overrides: Partial<Parameters<typeof runResultRevealSequence>[0]> = {}) {
  const log: string[] = [];
  return {
    log,
    steps: {
      reveal: async () => void log.push("reveal"),
      record: async () => void log.push("record"),
      publishFinished: () => void log.push("publishFinished"),
      isDisposed: () => false,
      ...overrides,
    },
  };
}

describe("runResultRevealSequence(順位発表のあとの手順)", () => {
  it("発表が終わってから保存し、保存が済んでから finished を公開する(順位が見える時点で結果は保存済み)", async () => {
    const { log, steps: s } = steps();
    await runResultRevealSequence(s);
    expect(log).toEqual(["reveal", "record", "publishFinished"]);
  });

  it("発表の途中では保存も finished の公開もしない", async () => {
    const { log, steps: s } = steps({ reveal: () => new Promise<void>(() => undefined) });
    void runResultRevealSequence(s);
    await Promise.resolve();
    expect(log).toEqual([]);
  });

  it("保存に失敗しても finished は公開する(参加者の画面を発表中のまま止めない)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { log, steps: s } = steps({ record: async () => Promise.reject(new Error("boom")) });
    await runResultRevealSequence(s);
    expect(log).toEqual(["reveal", "publishFinished"]);
    error.mockRestore();
  });

  it("画面を離れたあとは公開しない", async () => {
    const { log, steps: s } = steps({ isDisposed: () => true });
    await runResultRevealSequence(s);
    expect(log).toEqual(["reveal", "record"]);
  });
});
