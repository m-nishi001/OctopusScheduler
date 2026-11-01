import type { PrizeDto } from "@control/prize/dto/prize-dto";
import { delay, pause, step, type Step } from "./action-queue";
import { playBgm, preloadBgm, stopBgm } from "./bgm";
import { DrawStateError, type DrawContext } from "./draw-context";
import { KAKUHEN_TIMINGS } from "./kakuhen-timings";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import type { RoulettePrizeDto } from "./roulette/roulette-prize-preparer";
import { waitForWindowEvent } from "./wait-for-window-event";

const sleep = (ms: number) => delay(ms / 1000);

/**
 * 確変(kakuhen)の景品抽選の2段階演出(1サイクルにつき1つ作る)。
 *
 * 同じ景品を2つのセクターに複製して出す。1つ目は景品の画像1、2つ目は画像2。
 * ダミー抽選で1つ目(occurrence=1)に止め、メッセージを挟んで、本抽選で2つ目(occurrence=2)に止める。
 * 段階をまたいで持つ状態はこのインスタンスだけが持つ(サイクルが途中で中断しても次に残らない)。
 */
export class KakuhenSession {
  private dummy: RoulettePrizeDto | null = null;
  private final: RoulettePrizeDto | null = null;
  /** 複製を入れたルーレットの表示用データ。 */
  private prepared: RouletteItem[] | null = null;
  /** 複製を入れる前の景品一覧(本抽選のあとに元へ戻す)。 */
  private originalPrizes: RoulettePrizeDto[] | null = null;
  /** ダミーの当選ダイアログを出している間だけ退避する本来の当選景品。 */
  private shelvedPrize: PrizeDto | null = null;

  constructor(private readonly ctx: DrawContext) {}

  async startDummyDraw(): Promise<void> {
    const { ctx } = this;
    const prizes = ctx.prizes.value;
    const prizeRes = ctx.prizeRes.value;
    this.originalPrizes = prizes.slice();

    // 当選景品と、ダミー用の景品だけをルーレットに流す(当選景品は2つに複製する)
    const displayIds = [
      prizeRes?.winnerPrizeId,
      prizeRes?.dummyWinnerPrizeId,
      ...(prizeRes?.dummyPrizeIds || []),
    ].filter(Boolean) as string[];
    const shown: RoulettePrizeDto[] = [];
    for (const id of displayIds) {
      const p = prizes.find((x) => x.id === id);
      if (!p) continue;
      if (p.id !== prizeRes?.winnerPrizeId) {
        shown.push(p);
        continue;
      }
      this.dummy = {
        ...p,
        id: `${p.id}__k1`,
        originalPrizeId: p.id,
        winningImage1: p.winningImage1 || p.image,
        winningImage2: undefined,
      };
      this.final = {
        ...p,
        id: `${p.id}__k2`,
        image: p.image2,
        originalPrizeId: p.id,
        winningImage1: p.winningImage2 || p.image2,
        winningImage2: undefined,
      };
      shown.push(this.dummy, this.final);
    }

    this.prepared = await ctx.preparePrizes(shown);
    const anim = ctx.prizeAnim.value;
    try {
      if (anim?.updatePrizes) await anim.updatePrizes(this.prepared);
    } catch (e) {
      console.warn("[Kakuhen] failed to update animation items", e);
    }
    // アニメーション側が内部アイテムを作り終えるのを待つ(止めるときに複製セクターを見つけられるように)
    await sleep(KAKUHEN_TIMINGS.ANIMATION_ITEM_SYNC_WAIT_MS);
    try {
      anim?.startSpin?.();
    } catch (e) {
      console.warn("[Kakuhen] failed to start the dummy spin", e);
    }
    await preloadBgm(this.dummy?.bgm1, ctx);
  }

  async stopDummyDraw(): Promise<void> {
    const anim = this.ctx.prizeAnim.value;
    if (!anim?.stopSpin) return;
    await playBgm(this.dummy?.bgm1, this.ctx);
    await anim.stopSpin(KAKUHEN_TIMINGS.DUMMY_SPIN_DOWN_DURATION_MS / 1000, this.dummy?.id || null, 1);
  }

  async showMessage(): Promise<void> {
    await waitForWindowEvent("kakuhen.finished", KAKUHEN_TIMINGS.MESSAGE_FINISHED_FALLBACK_MS, () => {
      this.ctx.kakuhenOverlayVisible.value = true;
    });
    await sleep(KAKUHEN_TIMINGS.MESSAGE_HOLD_MS);
  }

  async hideMessage(): Promise<void> {
    await waitForWindowEvent("kakuhen.dismissed", KAKUHEN_TIMINGS.MESSAGE_DISMISSED_FALLBACK_MS, () => {
      this.ctx.kakuhenOverlayVisible.value = false;
    });
    await sleep(KAKUHEN_TIMINGS.POST_DISMISS_BUFFER_MS);
  }

  /** ダミー(画像1)の当選ダイアログを出す。ダイアログが見る当選景品をダミーに差し替える。 */
  async showDummyPrizeDialog(): Promise<void> {
    const { ctx } = this;
    const result = ctx.result.value;
    if (result) {
      this.shelvedPrize = result.wonPrize;
      result.wonPrize = this.dummy as PrizeDto | null;
      if (this.dummy) ctx.setSelectedPrize(this.dummy as PrizeDto);
    }
    await stopBgm();
    ctx.showPrizeWinningDialog.value = true;
    await sleep(KAKUHEN_TIMINGS.DUMMY_PRIZE_DIALOG_DISPLAY_MS);
  }

  closeDummyPrizeDialog(): void {
    const { ctx } = this;
    ctx.showPrizeWinningDialog.value = false;
    const shelved = this.shelvedPrize;
    this.shelvedPrize = null;
    if (ctx.result.value) ctx.result.value.wonPrize = shelved;
    if (shelved) ctx.setSelectedPrize(shelved);
  }

  async startFinalDraw(): Promise<void> {
    const { ctx } = this;
    await preloadBgm(this.final?.bgm2, ctx);
    await sleep(KAKUHEN_TIMINGS.FINAL_DRAW_PRE_SPIN_BUFFER_MS);
    try {
      const anim = ctx.prizeAnim.value;
      if (anim?.startSpin) {
        await anim.startSpin();
        await sleep(KAKUHEN_TIMINGS.FINAL_DRAW_POST_SPIN_START_BUFFER_MS);
      }
    } catch (e) {
      console.warn("[Kakuhen] failed to start the final spin", e);
    }
  }

  async stopFinalDraw(): Promise<void> {
    const { ctx } = this;
    const final = this.final;
    if (!final) throw new DrawStateError("確変の本抽選の景品がありません(ダミー抽選が完了していません)");
    const anim = ctx.prizeAnim.value;

    await playBgm(final.bgm2, ctx);
    if (anim?.stopSpin) {
      const items = await this.syncAnimationItems();
      const durationSec = KAKUHEN_TIMINGS.FINAL_SPIN_DOWN_DURATION_MS / 1000;
      if (items.length > 0 && !items.some((it) => it.id === final.id)) {
        // 複製したセクターが見つからないときは、最後のセクターに止める
        console.warn("[Kakuhen] final prize not found in animation items; stopping on the last item");
        await anim.stopSpin(durationSec, items[items.length - 1].id, 1);
      } else {
        await anim.stopSpin(durationSec, final.id, 2);
      }
    }

    await this.restoreOriginalPrizes(final);
  }

  /** アニメーションの内部アイテムを確変用に合わせ、現在のアイテムを返す(失敗しても進行は止めない)。 */
  private async syncAnimationItems(): Promise<Array<{ id: string }>> {
    const anim = this.ctx.prizeAnim.value;
    try {
      if (anim?.updatePrizes) {
        const items = this.prepared ?? (this.originalPrizes ? await this.ctx.preparePrizes(this.originalPrizes) : null);
        if (items) await anim.updatePrizes(items);
      }
      return anim?.getInternalItems?.() ?? [];
    } catch {
      return [];
    }
  }

  /** 複製を取り除いた元の景品一覧へ戻し、最終ダイアログには画像2だけの景品を見せる。 */
  private async restoreOriginalPrizes(final: RoulettePrizeDto): Promise<void> {
    const { ctx } = this;
    const original = this.originalPrizes;
    if (!original) return;
    const restoredItems = await ctx.preparePrizes(original);
    try {
      await ctx.prizeAnim.value?.updatePrizes?.(restoredItems);
    } catch (e) {
      console.warn("[Kakuhen] failed to restore animation items", e);
    }
    ctx.setSelectedPrize(final as PrizeDto);
    const winnerId = final.originalPrizeId || final.id;
    const winner = original.find((p) => p.id === winnerId);
    if (winner && ctx.result.value) {
      ctx.result.value.wonPrize = {
        ...winner,
        image: undefined,
        winningImage1: undefined,
        winningImage2: winner.winningImage2,
      } as PrizeDto;
    }
    this.originalPrizes = null;
    this.prepared = null;
  }
}

/** 確変の景品抽選のステップ(ダミー抽選 → メッセージ → 本抽選)。 */
export function kakuhenPrizeSteps(ctx: DrawContext): Step[] {
  const k = new KakuhenSession(ctx);
  return [
    step(() => k.startDummyDraw()),
    pause(),
    step(() => k.stopDummyDraw(), "stopKakuhenDummyDraw"),
    step(() => k.showDummyPrizeDialog()),
    step(() => k.showMessage()),
    step(() => k.hideMessage()),
    step(() => k.closeDummyPrizeDialog()),
    step(() => k.startFinalDraw()),
    step(() => k.stopFinalDraw(), "stopKakuhenFinalDraw"),
  ];
}
