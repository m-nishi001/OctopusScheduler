import { delay, pause, step, type Step } from "./action-queue";
import { playBgm, preloadBgm, stopBgm } from "./bgm";
import { requireSelectedPrize, type DrawContext } from "./draw-context";
import { kakuhenPrizeSteps } from "./kakuhen-session";

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

function memberSteps(ctx: DrawContext): Step[] {
  return [
    step(() => {
      ctx.phase.value = "member";
    }),
    pause(SETTLE_SEC.memberStage, ctx.wait),
    step(() => ctx.memberAnim.value?.startDraw(ctx.result.value?.wonMember?.id ?? null)),
    pause(SETTLE_SEC.spinning, ctx.wait),
    step(() => ctx.memberAnim.value?.stopDraw(), "stopMemberDraw"),
    pause(SETTLE_SEC.stopped, ctx.wait),
    step(() => {
      ctx.phase.value = "prize";
    }),
    pause(SETTLE_SEC.prizeStage, ctx.wait),
  ];
}

/** 通常の景品抽選1回ぶんの進行ステップ。回転を始める → 次の操作で BGM を鳴らして止める(この止める操作には `stopPrizeDraw` の目印がつく)。 */
export function normalPrizeSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      await preloadBgm(prize.bgm1AssetId, ctx);
      ctx.prizeAnim.value?.startSpin?.();
    }),
    pause(SETTLE_SEC.prizeSpinning, ctx.wait),
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      await playBgm(prize.bgm1AssetId, ctx);
      await ctx.prizeAnim.value?.stopSpin?.(ctx.prizeStopSec, prize.id, 1);
    }, "stopPrizeDraw"),
  ];
}

function winningDialogSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      await stopBgm();
      ctx.showPrizeWinningDialog.value = true;
    }),
    pause(SETTLE_SEC.dialog, ctx.wait),
    step(() => {
      ctx.showPrizeWinningDialog.value = false;
    }),
  ];
}

/**
 * 景品がちょうど半分になったら知らせる。
 * 終了(景品かメンバーが尽きた)は、サイクルの外で進行役が抽選の前に判定する(DrawFlowController)。
 */
export function remainingSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const { total, remaining } = await ctx.drawService.getLastPrizeCount();
      if (total > 0 && remaining > 0 && remaining * 2 === total) {
        ctx.showHalfRemainingDialog.value = true;
        await (ctx.wait ?? delay)(3);
        ctx.showHalfRemainingDialog.value = false;
      }
    }),
  ];
}
