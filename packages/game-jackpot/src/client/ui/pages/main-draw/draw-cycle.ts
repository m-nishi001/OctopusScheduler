import { delay, pause, step, type Step } from "./action-queue";
import { playWinningBgm, preloadBgm } from "./bgm";
import { SHOW_PRIZE_RESULT } from "@model/jackpot-host-state";
import { requireSelectedPrize, type DrawContext } from "./draw-context";
import { kakuhenPrizeSteps } from "./kakuhen-session";
import { crossedHalf } from "@model/draw/half-remaining";
import { shouldHoldLotteryBgm } from "./use-lottery-bgm";

/**
 * 進行操作の後に、演出が落ち着くまで操作を受け付けない時間(秒)。進行操作で画面が変わるたびに必要な分だけ待つ。
 * 抽選・保存先の通信はここに含めない(先に裏で済ませる。CycleSource)。
 */
export const SETTLE_SEC = {
  /** メンバー抽選の画面を出した後(リールを並べて写真が出るまで。写真は先に読んであるので短くてよい)。 */
  memberStage: 0.5,
  /** メンバー抽選のリールが回り始めた後 / 止まった後 / 景品抽選の画面を出した後 / ルーレットが回り始めた後 / 当選ダイアログを出した後。 */
  spinning: 1,
  stopped: 1,
  prizeStage: 1,
  prizeSpinning: 1,
  dialog: 1,
} as const;

/**
 * 抽選1回ぶんのステップ。メンバー抽選 → 景品抽選(通常 or 確変) → 当選ダイアログ → 残数の確認。
 * pause のところでEnter待ちになる。label 付きは「ここで止める操作」(参加者のスマホにも停止ボタンを出す)。
 */
export function buildCycle(ctx: DrawContext, isKakuhen: boolean): Step[] {
  return [
    ...memberSteps(ctx),
    ...(isKakuhen ? kakuhenPrizeSteps(ctx) : normalPrizeSteps(ctx)),
    ...winningDialogSteps(ctx),
    ...remainingSteps(ctx),
  ];
}

/**
 * 当選者を飛ばして引き直したあとのステップ。メンバー抽選だけやり直し、景品は演出し直さずに結果(当選ダイアログ)だけ見せる
 * (景品はもう決まっている。確変の演出もやり直さない)。`withRemaining`: 元のサイクルの「残数の確認」がまだだったときだけ付ける。
 */
export function buildSkipCycle(ctx: DrawContext, withRemaining: boolean): Step[] {
  return [
    ...memberSteps(ctx),
    // 景品が画面に見えた印だけ(参加者のスマホに停止ボタンは出ない)。次の操作で当選ダイアログを出す
    step(() => undefined, SHOW_PRIZE_RESULT),
    ...winningDialogSteps(ctx),
    ...(withRemaining ? remainingSteps(ctx) : []),
  ];
}

function memberSteps(ctx: DrawContext): Step[] {
  return [
    step(() => {
      ctx.phase.value = "member";
    }),
    pause(SETTLE_SEC.memberStage, ctx.wait),
    step(() => ctx.memberAnim.value?.startDraw(ctx.result.value?.wonMember?.id ?? null)),
    pause(SETTLE_SEC.spinning, ctx.wait),
    step(() => ctx.memberAnim.value?.stopDraw(ctx.memberStopSec), "stopMemberDraw"),
    pause(SETTLE_SEC.stopped, ctx.wait),
    step(() => {
      ctx.phase.value = "prize";
    }),
    pause(SETTLE_SEC.prizeStage, ctx.wait),
  ];
}

/** 通常の景品抽選1回ぶんの進行ステップ。回転を始める(景品抽選BGMを流す) → 次の操作で当選BGMを1回鳴らす(景品抽選BGMは、当選BGMがあれば即止め、無ければ止まるまで流して止まったらフェードアウトする。どちらも結果の表示中は無音)(この止める操作には `stopPrizeDraw` の目印がつく)。 */
export function normalPrizeSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      await preloadBgm(prize.bgm1, ctx);
      ctx.prizeAnim.value?.startSpin?.();
      ctx.prizeLotteryBgm.playRandom(); // 待たない(音の都合で進行を止めない)
    }),
    pause(SETTLE_SEC.prizeSpinning, ctx.wait),
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      // 当選BGMがあれば、景品抽選BGMは停止開始で即止める。無ければ、止まるまで流して止まったらフェードアウトする
      const hold = shouldHoldLotteryBgm(prize.bgm1);
      if (!hold) void ctx.prizeLotteryBgm.stop();
      await playWinningBgm(prize.bgm1, ctx.prizeStopSec, ctx);
      await ctx.prizeAnim.value?.stopSpin?.(ctx.prizeStopSec, prize.id, 1);
      if (hold) void ctx.prizeLotteryBgm.fadeOut();
    }, "stopPrizeDraw"),
  ];
}

function winningDialogSteps(ctx: DrawContext): Step[] {
  return [
    step(() => {
      ctx.showPrizeWinningDialog.value = true;
    }),
    pause(SETTLE_SEC.dialog, ctx.wait),
    step(() => {
      ctx.showPrizeWinningDialog.value = false;
    }),
  ];
}

/**
 * 景品が半分以下になった最初の回に、1度だけ知らせる(判定は crossedHalf。この抽選を確定した時点の数で見る)。
 * 終了(景品かメンバーが尽きた)は、サイクルの外で進行役が抽選の前に判定する(DrawFlowController)。
 */
export function remainingSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const counts = ctx.prizeCounts.value;
      if (counts && crossedHalf(counts)) {
        ctx.showHalfRemainingDialog.value = true;
        await (ctx.wait ?? delay)(3);
        ctx.showHalfRemainingDialog.value = false;
      }
    }),
  ];
}
