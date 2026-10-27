import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActionQueue, type Step } from "./action-queue";
import { DrawFlowController } from "./draw-flow-controller";
import { toDrawProgress } from "@control/draw/dto/draw-progress";
import { buildCycle, normalPrizeSteps, remainingSteps, SETTLE_SEC } from "./draw-cycle";
import { DrawStateError } from "./draw-context";
import { createTestContext } from "./draw-context.test-helper";

const labelsOf = (steps: Step[]) => steps.filter((s) => s.label).map((s) => s.label);
/** 各ステップが「Enter待ちか」を 1 / 0 で並べる。進行の“形”を固定するための表現。 */
const pauseShape = (steps: Step[]) => steps.map((s) => (s.pause ? "P" : "."));

describe("buildCycle の形(進行の停止位置・ラベル)", () => {
  it("通常: 停止ステップのラベルは stopMemberDraw と stopPrizeDraw だけ(遠隔の停止ボタンの根拠)", () => {
    const steps = buildCycle(createTestContext(), false);
    expect(labelsOf(steps)).toEqual(["stopMemberDraw", "stopPrizeDraw"]);
  });

  it("確変: 停止ステップのラベルは member / dummy / final の3つ", () => {
    const steps = buildCycle(createTestContext(), true);
    expect(labelsOf(steps)).toEqual(["stopMemberDraw", "stopKakuhenDummyDraw", "stopKakuhenFinalDraw"]);
  });

  it("通常: Enter待ちの位置が従来どおり(メンバー4回 + 景品2回 + 当選ダイアログ1回)", () => {
    // 従来は wait() が次のEnterを待つ区切りだった。区切りの位置をここで固定する。
    expect(pauseShape(buildCycle(createTestContext(), false)).join("")).toBe(
      // member: 開始P / 回転開始P / 停止P / 景品へP,  prize: 回転開始P / 停止,  dialog: 表示P / 閉じる,  残数(半分の通知): 1ステップ(終了は進行役が判定)
      ".P.P.P.P" + ".P." + ".P." + "."
    );
  });

  it("確変: Enter待ちの位置が従来どおり", () => {
    expect(pauseShape(buildCycle(createTestContext(), true)).join("")).toBe(
      ".P.P.P.P" + ".P......." + ".P." + "."
    );
  });
});

describe("演出の待ち時間(SETTLE_SEC)", () => {
  it("待ちは差し替えられ、各 pause は決めた秒数だけ待つ(時間を進めずに確かめられる)", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const steps = buildCycle(createTestContext({ wait }), false);
    for (const s of steps.filter((x) => x.pause)) await s.run();
    expect(wait.mock.calls.map((c) => c[0])).toEqual([
      SETTLE_SEC.memberStage,
      SETTLE_SEC.spinning,
      SETTLE_SEC.stopped,
      SETTLE_SEC.prizeStage,
      SETTLE_SEC.prizeSpinning,
      SETTLE_SEC.dialog,
    ]);
  });

  it("メンバー抽選の画面を出した後の待ちは、写真を先に読んである分だけ他より短い。ほかは演出に要る1秒を保つ", () => {
    expect(SETTLE_SEC.memberStage).toBeLessThan(1);
    expect(SETTLE_SEC.memberStage).toBeGreaterThan(0);
    for (const k of ["spinning", "stopped", "prizeStage", "prizeSpinning", "dialog"] as const) expect(SETTLE_SEC[k]).toBe(1);
  });

  it("半分の知らせの3秒も、差し替えた待ちで待つ", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const ctx = createTestContext({ wait, drawService: { getLastPrizeCount: vi.fn().mockResolvedValue({ total: 10, remaining: 5 }) } });
    await remainingSteps(ctx)[0].run();
    expect(wait).toHaveBeenCalledWith(3);
    expect(ctx.showHalfRemainingDialog.value).toBe(false);
  });
});

describe("サイクルを実際に進める(DrawFlowController と組み合わせ)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function run(ctx: ReturnType<typeof createTestContext>, isKakuhen = false) {
    const queue = new ActionQueue();
    const settled = vi.fn();
    const flow = new DrawFlowController({
      queue,
      // サイクルが終わったら止める(景品が尽きた)
      nextCycle: async () => ({ kind: "finished" as const, progress: toDrawProgress(0, 0, 1, 3) }),
      onDrawError: vi.fn(),
      onStepError: vi.fn(),
      onFinished: vi.fn(),
      onLeave: vi.fn(),
      onSettled: settled,
    });
    flow.ready = true;
    // 景品が尽きた状態だと最初の抽選ができないので、先にサイクルを積む
    queue.addCycle(buildCycle(ctx, isKakuhen));
    const advance = async () => {
      const p = flow.advance();
      await vi.runAllTimersAsync();
      await p;
    };
    return { advance, queue, settled };
  }

  it("通常サイクルを Enter ごとに進めると、画面の状態が期待どおりに変わる", async () => {
    const ctx = createTestContext();
    ctx.selectedPrize.value = { id: "p1", bgm1AssetId: null };
    const { advance, queue } = run(ctx);

    await advance(); // メンバー抽選の画面へ
    expect(ctx.phase.value).toBe("member");

    await advance(); // メンバー抽選を回し始める
    expect(ctx.memberAnim.value.startDraw).toHaveBeenCalledWith("m1");

    await advance(); // 止める
    expect(ctx.memberAnim.value.stopDraw).toHaveBeenCalledTimes(1);

    await advance(); // 景品抽選の画面へ
    expect(ctx.phase.value).toBe("prize");

    await advance(); // ルーレットを回し始める
    expect(ctx.prizeAnim.value.startSpin).toHaveBeenCalledTimes(1);

    await advance(); // 止めて、当選ダイアログを出す
    expect(ctx.prizeAnim.value.stopSpin).toHaveBeenCalledWith(3, "p1", 1);
    expect(ctx.showPrizeWinningDialog.value).toBe(true);

    await advance(); // ダイアログを閉じて、残数を確認する
    expect(ctx.showPrizeWinningDialog.value).toBe(false);
    expect(queue.isEmpty()).toBe(true);
  });
});

describe("normalPrizeSteps", () => {
  it("景品が選ばれていない状態で動かしても、null 参照ではなく原因の分かるエラーになる(今回の不具合)", async () => {
    const ctx = createTestContext();
    ctx.selectedPrize.value = null;
    const [start, , stop] = normalPrizeSteps(ctx);

    await expect(start.run()).rejects.toBeInstanceOf(DrawStateError);
    await expect(stop.run()).rejects.toBeInstanceOf(DrawStateError);
    await expect(start.run()).rejects.toThrow("抽選された景品がありません");
  });

  it("演出コンポーネントがまだ無くても落ちない(開始・停止とも何もしない)", async () => {
    const ctx = createTestContext({ prizeAnim: { value: null } });
    ctx.selectedPrize.value = { id: "p1" };
    const [start, , stop] = normalPrizeSteps(ctx);

    await expect(start.run()).resolves.toBeUndefined();
    await expect(stop.run()).resolves.toBeUndefined();
  });
});

describe("remainingSteps", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const withCount = (count: { total: number; remaining: number }) =>
    createTestContext({ drawService: { getLastPrizeCount: vi.fn().mockResolvedValue(count) } });

  it("ちょうど半分になったら、3秒間だけ「半分」ダイアログを出して閉じる", async () => {
    const ctx = withCount({ total: 10, remaining: 5 });
    const [half] = remainingSteps(ctx);

    const p = half.run();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.showHalfRemainingDialog.value).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(ctx.showHalfRemainingDialog.value).toBe(false);
  });

  it("半分でなければ「半分」ダイアログは出さない", async () => {
    const ctx = withCount({ total: 10, remaining: 3 });
    await remainingSteps(ctx)[0].run();
    expect(ctx.showHalfRemainingDialog.value).toBe(false);
  });
});
