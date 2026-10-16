import { describe, it, expect, vi } from "vitest";
import { ActionQueue, type Step } from "./action-queue";
import { DrawFlowController } from "./draw-flow-controller";

/** 実行順を記録するステップ。pause 付きなら次のEnterを待つ。 */
function makeCycle(log: string[], name: string, pausesAfter: number[] = []): Step[] {
  return [1, 2, 3].map((n) => ({
    run: async () => {
      log.push(`${name}${n}`);
    },
    pause: pausesAfter.includes(n),
  }));
}

function setup(options: { remaining?: number[]; cycles?: Array<Step[] | Error> } = {}) {
  const log: string[] = [];
  const remaining = [...(options.remaining ?? [1])];
  const cycles = [...(options.cycles ?? [makeCycle(log, "a", [2])])];
  const deps = {
    queue: new ActionQueue(),
    remainingPrizes: vi.fn(async () => (remaining.length > 1 ? remaining.shift()! : remaining[0])),
    drawNextCycle: vi.fn(async () => {
      const next = cycles.shift();
      if (!next) throw new Error("no more cycles");
      if (next instanceof Error) throw next;
      return next;
    }),
    onDrawError: vi.fn(),
    onStepError: vi.fn(),
    onSettled: vi.fn(),
  };
  const flow = new DrawFlowController(deps);
  flow.ready = true;
  return { flow, deps, log };
}

describe("DrawFlowController", () => {
  it("pause のステップまで連続して進み、次の操作で続きから進む", async () => {
    const { flow, deps, log } = setup();

    await flow.advance();
    expect(log).toEqual(["a1", "a2"]);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);

    await flow.advance();
    expect(log).toEqual(["a1", "a2", "a3"]);
  });

  it("サイクルが終わって景品が残っていれば、同じ操作の中で次の抽選を引いて続ける", async () => {
    const log: string[] = [];
    const { flow, deps } = setup({
      remaining: [2],
      cycles: [makeCycle(log, "a"), makeCycle(log, "b", [1])],
    });
    await flow.advance();
    expect(deps.drawNextCycle).toHaveBeenCalledTimes(2);
    expect(log).toEqual(["a1", "a2", "a3", "b1"]);
  });

  it("景品が残っていなければ抽選せずに止まる", async () => {
    const { flow, deps, log } = setup({ remaining: [0] });

    await flow.advance();

    expect(deps.drawNextCycle).not.toHaveBeenCalled();
    expect(log).toEqual([]);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });

  describe("抽選の失敗(今回の不具合)", () => {
    it("サイクルを積まず、エラーを通知して止まる(壊れたステップを実行しない)", async () => {
      const { flow, deps, log } = setup({ cycles: [new Error("対象のメンバーがいません")] });

      await flow.advance();

      expect(deps.onDrawError).toHaveBeenCalledWith(expect.objectContaining({ message: "対象のメンバーがいません" }));
      expect(deps.onStepError).not.toHaveBeenCalled();
      expect(deps.queue.isEmpty()).toBe(true);
      expect(log).toEqual([]);
      expect(deps.onSettled).toHaveBeenCalledTimes(1);
    });

    it("次の操作でもう一度抽選して復帰できる(固まらない)", async () => {
      const log: string[] = [];
      const { flow, deps } = setup({ cycles: [new Error("一時的な失敗"), makeCycle(log, "r", [1])] });

      await flow.advance();
      await flow.advance();

      expect(deps.drawNextCycle).toHaveBeenCalledTimes(2);
      expect(deps.onDrawError).toHaveBeenCalledTimes(1);
      expect(log).toEqual(["r1"]);
    });
  });

  describe("ステップの失敗", () => {
    it("通知して止まり、失敗したステップは捨てて次の操作で続きから進む", async () => {
      const log: string[] = [];
      const boom = new Error("boom");
      const cycle: Step[] = [
        { run: async () => void log.push("s1") },
        { run: async () => { throw boom; } },
        { run: async () => void log.push("s3") },
      ];
      const { flow, deps } = setup({ cycles: [cycle] });

      await flow.advance();
      expect(log).toEqual(["s1"]);
      expect(deps.onStepError).toHaveBeenCalledWith(boom);

      await flow.advance();
      expect(log).toEqual(["s1", "s3"]);
    });
  });

  describe("多重実行と準備前の操作", () => {
    it("実行中の進行操作は無視する(二重に抽選・実行しない)", async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const log: string[] = [];
      const cycle: Step[] = [
        { run: async () => { await gate; log.push("slow"); }, pause: true },
      ];
      const { flow, deps } = setup({ cycles: [cycle] });

      const first = flow.advance();
      await flow.advance();
      await flow.advance();
      release();
      await first;

      expect(deps.drawNextCycle).toHaveBeenCalledTimes(1);
      expect(log).toEqual(["slow"]);
      expect(deps.onSettled).toHaveBeenCalledTimes(1);
    });

    it("ready になるまでの進行操作は無視する", async () => {
      const { flow, deps } = setup();
      flow.ready = false;

      await flow.advance();

      expect(deps.remainingPrizes).not.toHaveBeenCalled();
      expect(deps.drawNextCycle).not.toHaveBeenCalled();
      expect(deps.onSettled).not.toHaveBeenCalled();
    });
  });
});
