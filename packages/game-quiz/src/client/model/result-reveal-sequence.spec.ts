import { describe, expect, it, vi } from "vitest";
import { runResultRevealSequence } from "./result-reveal-sequence";

type Steps = Parameters<typeof runResultRevealSequence>[0];

function steps(overrides: Partial<Steps> = {}) {
  const log: string[] = [];
  return {
    log,
    steps: {
      // 既定は「当選者がいて、発表の途中で祝福演出が始まる」流れ
      reveal: async (onCelebrate: () => void) => {
        log.push("reveal:start");
        onCelebrate();
        await Promise.resolve();
        log.push("reveal:end");
      },
      record: async () => void log.push("record"),
      publishFinished: () => void log.push("publishFinished"),
      isDisposed: () => false,
      ...overrides,
    } satisfies Steps,
  };
}

describe("runResultRevealSequence(順位発表のあとの手順)", () => {
  it("保存は発表の演出より先(並行)に始める", async () => {
    const { log, steps: s } = steps();
    await runResultRevealSequence(s);
    expect(log.indexOf("record")).toBeLessThan(log.indexOf("reveal:start"));
  });

  it("祝福演出が始まったら、保存が済んでいる時点で finished を公開する(演出の終わりを待たない)", async () => {
    const { log, steps: s } = steps({
      reveal: async (onCelebrate) => {
        await Promise.resolve();
        onCelebrate();
        await Promise.resolve();
        await Promise.resolve();
        // 祝福演出の保持時間の途中でも、すでに公開されている
        log.push("holding");
      },
    });
    await runResultRevealSequence(s);
    expect(log.indexOf("publishFinished")).toBeLessThan(log.indexOf("holding"));
    expect(log.filter((l) => l === "publishFinished")).toHaveLength(1);
  });

  it("保存が遅いときは、祝福演出が始まっても保存が済むまで finished を公開しない", async () => {
    let finishRecord: () => void = () => undefined;
    const { log, steps: s } = steps({
      record: () =>
        new Promise<void>((resolve) => {
          finishRecord = () => {
            log.push("record");
            resolve();
          };
        }),
    });
    const done = runResultRevealSequence(s);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toEqual(["reveal:start", "reveal:end"]);
    finishRecord();
    await done;
    expect(log).toEqual(["reveal:start", "reveal:end", "record", "publishFinished"]);
  });

  it("当選者がいない(祝福演出が無い)ときは、発表が終わってから公開する", async () => {
    const { log, steps: s } = steps({
      reveal: async () => void log.push("reveal"),
    });
    await runResultRevealSequence(s);
    expect(log).toEqual(["record", "reveal", "publishFinished"]);
  });

  it("発表の途中では finished を公開しない", async () => {
    const { log, steps: s } = steps({ reveal: () => new Promise<void>(() => undefined) });
    void runResultRevealSequence(s);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).not.toContain("publishFinished");
  });

  it("保存に失敗しても finished は公開する(参加者の画面を発表中のまま止めない)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { log, steps: s } = steps({ record: async () => Promise.reject(new Error("boom")) });
    await runResultRevealSequence(s);
    expect(log).toContain("publishFinished");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("画面を離れたあとは公開しない", async () => {
    const { log, steps: s } = steps({ isDisposed: () => true });
    await runResultRevealSequence(s);
    expect(log).toContain("record");
    expect(log).not.toContain("publishFinished");
  });
});
