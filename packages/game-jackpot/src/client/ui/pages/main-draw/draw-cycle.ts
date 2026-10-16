import { delay, pause, step, type Step } from "./action-queue";
import { playBgm, preloadBgm, stopBgm } from "./bgm";
import { requireSelectedPrize, type DrawContext } from "./draw-context";
import { kakuhenPrizeSteps } from "./kakuhen-session";

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

export function memberSteps(ctx: DrawContext): Step[] {
  return [
    step(() => {
      ctx.phase.value = "member";
    }),
    pause(),
    step(() => ctx.memberAnim.value?.startDraw(ctx.result.value?.wonMember?.id ?? null)),
    pause(),
    step(() => ctx.memberAnim.value?.stopDraw(), "stopMemberDraw"),
    pause(),
    step(() => {
      ctx.phase.value = "prize";
    }),
    pause(),
  ];
}

export function normalPrizeSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      await preloadBgm(prize.bgm1AssetId, ctx);
      ctx.prizeAnim.value?.startSpin?.();
    }),
    pause(),
    step(async () => {
      const prize = requireSelectedPrize(ctx);
      await playBgm(prize.bgm1AssetId, ctx);
      await ctx.prizeAnim.value?.stopSpin?.(3, prize.id, 1);
    }, "stopPrizeDraw"),
  ];
}

export function winningDialogSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      await stopBgm();
      ctx.showPrizeWinningDialog.value = true;
    }),
    pause(),
    step(() => {
      ctx.showPrizeWinningDialog.value = false;
    }),
  ];
}

/** 景品がちょうど半分になったら知らせ、全部なくなったら終了を知らせる。 */
export function remainingSteps(ctx: DrawContext): Step[] {
  return [
    step(async () => {
      const { total, remaining } = await ctx.drawService.getLastPrizeCount();
      if (total > 0 && remaining > 0 && remaining * 2 === total) {
        ctx.showHalfRemainingDialog.value = true;
        await delay(3);
        ctx.showHalfRemainingDialog.value = false;
      }
    }),
    step(async () => {
      const { remaining } = await ctx.drawService.getLastPrizeCount();
      if (remaining <= 0) ctx.showEndDialog.value = true;
    }),
  ];
}
