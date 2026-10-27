import { describe, it, expect, vi } from "vitest";
import { ActionQueue, type Step } from "./action-queue";
import { toDrawProgress } from "@control/draw/dto/draw-progress";
import { DrawFlowController, MIN_END_DISPLAY_MS, type NextCycle } from "./draw-flow-controller";
import { CycleSource } from "./cycle-source";

/** 実行順を記録するステップ。pause 付きなら次のEnterを待つ。 */
function makeCycle(log: string[], name: string, pausesAfter: number[] = []): Step[] {
  return [1, 2, 3].map((n) => ({
    run: async () => {
      log.push(`${name}${n}`);
    },
    pause: pausesAfter.includes(n),
  }));
}

/** remaining: 景品の残数の推移、members: 抽選の対象の残りメンバー数の推移(最後の値が続く)。 */
function setup(options: { remaining?: number[]; members?: number[]; cycles?: Array<Step[] | Error> } = {}) {
  const log: string[] = [];
  const remaining = [...(options.remaining ?? [1])];
  const members = [...(options.members ?? [99])];
  const cycles = [...(options.cycles ?? [makeCycle(log, "a", [2])])];
  const clock = { ms: 1_000_000 };
  const next = (list: number[]) => (list.length > 1 ? list.shift()! : list[0]);
  // 終了の確認は1回以上抽選したあとだけ有効(drawn)。このテストは抽選済みとして扱う。
  const progress = vi.fn(async () => toDrawProgress(next(remaining), next(members), 1, 5));
  const drawNextCycle = vi.fn(async () => {
    const next = cycles.shift();
    if (!next) throw new Error("no more cycles");
    if (next instanceof Error) throw next;
    return next;
  });
  const deps = {
    queue: new ActionQueue(),
    progress,
    drawNextCycle,
    onFinished: vi.fn(),
    onLeave: vi.fn(),
    now: () => clock.ms,
    nextCycle: async (): Promise<NextCycle> => {
      const p = await progress();
      if (p.endReason) return { kind: "finished", progress: p };
      return { kind: "cycle", steps: await drawNextCycle() };
    },
    onDrawError: vi.fn(),
    onStepError: vi.fn(),
    onStarted: vi.fn(),
    onSettled: vi.fn(),
  };
  const flow = new DrawFlowController(deps);
  flow.ready = true;
  return { flow, deps, log, clock };
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

  describe("抽選の終了(今回の不具合)", () => {
    it("景品が残っていなければ抽選せずに終了を通知して止まる", async () => {
      const { flow, deps, log } = setup({ remaining: [0] });

      await flow.advance();

      expect(deps.drawNextCycle).not.toHaveBeenCalled();
      expect(deps.onFinished).toHaveBeenCalledWith("prizes", expect.anything());
      expect(flow.finished).toBe(true);
      expect(log).toEqual([]);
      expect(deps.onSettled).toHaveBeenCalledTimes(1);
    });

    it("景品が残っていても、対象のメンバーが尽きたら抽選せずに終了を通知する(メンバー4人 < 景品10件)", async () => {
      const log: string[] = [];
      const { flow, deps } = setup({ remaining: [10], members: [1, 0], cycles: [makeCycle(log, "a", [1]), makeCycle(log, "b", [1])] });

      await flow.advance(); // 4人目(最後の1人)の抽選
      expect(deps.onFinished).not.toHaveBeenCalled();
      await flow.advance(); // サイクルを終えると、メンバーが尽きているので次の抽選は引かない
      await flow.advance();

      expect(deps.drawNextCycle).toHaveBeenCalledTimes(1);
      expect(deps.onDrawError).not.toHaveBeenCalled(); // 「No member winner」の失敗を繰り返さない
      expect(deps.onFinished).toHaveBeenCalledWith("members", expect.anything());
      expect(flow.finished).toBe(true);
    });

    it("景品もメンバーも尽きたときは、景品の終了として通知する", async () => {
      const { flow, deps } = setup({ remaining: [0], members: [0] });
      await flow.advance();
      expect(deps.onFinished).toHaveBeenCalledWith("prizes", expect.anything());
    });

    it("終了後の進行操作(次へ・Enter・OK)は結果の画面へ進む。ただし表示の直後は連打で飛ばさない", async () => {
      const { flow, deps, clock } = setup({ remaining: [0] });
      await flow.advance(); // 終了の画面を出す

      await flow.advance(); // 出た直後の連打
      expect(deps.onLeave).not.toHaveBeenCalled();

      clock.ms += MIN_END_DISPLAY_MS;
      await flow.advance();
      expect(deps.onLeave).toHaveBeenCalledTimes(1);
      expect(deps.drawNextCycle).not.toHaveBeenCalled();
    });

    it("結果の画面へ進むのは1回だけ(連打・Enterとボタンの重なりで二重に遷移しない)", async () => {
      const { flow, deps, clock } = setup({ remaining: [0] });
      await flow.advance();
      clock.ms += MIN_END_DISPLAY_MS;
      await Promise.all([flow.advance(), flow.advance(), flow.advance()]);
      await flow.advance();
      expect(deps.onLeave).toHaveBeenCalledTimes(1);
    });

    it("終了の判定に失敗したら(対象の一覧を取得できないなど)終了にせず、抽選の失敗として通知する", async () => {
      const { flow, deps } = setup();
      deps.progress.mockRejectedValueOnce(new Error("名簿を取得できません"));
      await flow.advance();
      expect(deps.onDrawError).toHaveBeenCalledWith(expect.objectContaining({ message: "名簿を取得できません" }));
      expect(deps.onFinished).not.toHaveBeenCalled();
      expect(flow.finished).toBe(false);
    });
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
      expect(deps.onStarted).toHaveBeenCalledTimes(1); // 無視された操作では呼ばない
    });

    it("onStarted は、有効な進行操作ごとにステップを実行する前に1回だけ呼ぶ", async () => {
      const { flow, deps, log } = setup();
      const before: number[] = [];
      deps.onStarted.mockImplementation(() => void before.push(log.length));

      await flow.advance();
      expect(deps.onStarted).toHaveBeenCalledTimes(1);
      await flow.advance();
      expect(deps.onStarted).toHaveBeenCalledTimes(2);
      expect(before).toEqual([0, 2]); // どちらもステップの実行前
    });

    it("ready になるまでの進行操作は無視する", async () => {
      const { flow, deps } = setup();
      flow.ready = false;

      await flow.advance();

      expect(deps.progress).not.toHaveBeenCalled();
      expect(deps.drawNextCycle).not.toHaveBeenCalled();
      expect(deps.onStarted).not.toHaveBeenCalled();
      expect(deps.onSettled).not.toHaveBeenCalled();
    });
  });
});

/** 先に用意した次のサイクルを使う進行(CycleSource と組み合わせる)。 */
describe("DrawFlowController + CycleSource(次のサイクルの先読み)", () => {
  type Prepared = NextCycle;
  function build(prepareImpl: () => Promise<Prepared>) {
    const log: string[] = [];
    const prepare = vi.fn(prepareImpl);
    const refresh = vi.fn(async () => undefined);
    const discard = vi.fn();
    const source = new CycleSource<Prepared>({ refresh, prepare, discard });
    const onFinished = vi.fn();
    const onDrawError = vi.fn(() => source.invalidate());
    const flow = new DrawFlowController({
      queue: new ActionQueue(),
      nextCycle: () => source.next(),
      onDrawError,
      onStepError: vi.fn(),
      onFinished,
      onLeave: vi.fn(),
      onSettled: vi.fn(),
    });
    flow.ready = true;
    return { flow, source, prepare, refresh, discard, log, onFinished, onDrawError };
  }
  const cycle = (log: string[], name: string): Prepared => ({ kind: "cycle", steps: [{ run: async () => void log.push(name), pause: true }] });
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it("先に用意してあれば、押下では通信(読み直し・抽選)をせず、用意したサイクルをすぐ積む", async () => {
    const log: string[] = [];
    const { flow, source, prepare, refresh } = build(async () => cycle(log, "pre"));
    source.prefetch("d0");
    await flush();
    prepare.mockClear();
    refresh.mockClear();

    await flow.advance();

    expect(log).toEqual(["pre"]);
    expect(prepare).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("用意の最中に押されたら、出来上がりを待って使う(二重に抽選・確定しない)", async () => {
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { flow, source, prepare } = build(async () => {
      await gate;
      return cycle(log, "pre");
    });
    source.prefetch("d0");
    const pressed = flow.advance();
    await flush();
    release();
    await pressed;
    expect(log).toEqual(["pre"]);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("用意が失敗していたら、その場で用意して進む(従来どおり。止まらない)", async () => {
    const log: string[] = [];
    const impl = vi.fn().mockRejectedValueOnce(new Error("conflict")).mockResolvedValueOnce(cycle(log, "sync"));
    const { flow, source, onDrawError } = build(impl);
    source.prefetch("d0");
    await flush();

    await flow.advance();

    expect(log).toEqual(["sync"]);
    expect(onDrawError).not.toHaveBeenCalled();
  });

  it("先に用意したものが終了なら、終了の画面を出す(抽選しない)", async () => {
    const { flow, source, onFinished } = build(async () => ({ kind: "finished", progress: toDrawProgress(0, 3, 5, 5) }));
    source.prefetch("d0");
    await flush();
    await flow.advance();
    expect(onFinished).toHaveBeenCalledWith("prizes", expect.anything());
    expect(flow.finished).toBe(true);
  });

  it("無効化(リセットなど)したら、用意したものは使わず、その場で用意し直す", async () => {
    const log: string[] = [];
    const impl = vi.fn().mockResolvedValueOnce(cycle(log, "stale")).mockResolvedValueOnce(cycle(log, "fresh"));
    const { flow, source, discard } = build(impl);
    source.prefetch("d0");
    await flush();
    source.invalidate();
    await flow.advance();
    expect(log).toEqual(["fresh"]);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("実行中の押下は捨てる(先に用意したものも二重に使わない)", async () => {
    const log: string[] = [];
    const { flow, source, prepare } = build(async () => cycle(log, "pre"));
    source.prefetch("d0");
    await flush();
    prepare.mockClear();
    const first = flow.advance();
    await flow.advance();
    await flow.advance();
    await first;
    expect(log).toEqual(["pre"]);
    expect(prepare).not.toHaveBeenCalled();
  });
});
