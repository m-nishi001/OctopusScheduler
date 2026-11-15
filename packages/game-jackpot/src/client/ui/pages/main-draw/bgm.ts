import type { DrawContext } from "./draw-context";
import { RouletteBgmManager } from "./roulette/roulette-bgm-manager";

type BgmLoader = Pick<DrawContext, "loadBgmBlob">;

/** BGMの再生に失敗しても演出は止めない。 */
export async function playBgm(name: string | null | undefined, ctx: BgmLoader): Promise<void> {
  try {
    await RouletteBgmManager.playMedia(name || null, ctx.loadBgmBlob);
  } catch (e) {
    console.warn("[Bgm] failed to play", e);
  }
}

/** 当選BGMが消えるまでのフェードの長さ(ミリ秒)の上限。 */
export const WINNING_BGM_FADE_MS = 1500;

/** 停止開始から `stopSec` 秒後に無音になるよう、フェードを始めるまでの待ち(ミリ秒)。 */
export function fadeStartDelayMs(stopSec: number, fadeMs: number): number {
  return Math.max(0, stopSec * 1000 - fadeMs);
}

/**
 * 当選BGMを1回だけ流し、停止開始から `stopSec` 秒後(リールが止まる瞬間)に無音になるようフェードを予約する。
 * フェードは時間で予約するだけで、待たない(音の都合で進行を止めない)。失敗しても演出は止めない。
 */
export async function playWinningBgm(name: string | null | undefined, stopSec: number, ctx: BgmLoader): Promise<void> {
  const fadeMs = Math.min(WINNING_BGM_FADE_MS, Math.max(0, stopSec * 1000));
  setTimeout(() => {
    void RouletteBgmManager.fadeOut(fadeMs);
  }, fadeStartDelayMs(stopSec, fadeMs));
  await playBgm(name, ctx);
}

/** 次に鳴らすBGMを先に読み込んでおく(失敗しても演出は止めない)。 */
export async function preloadBgm(name: string | null | undefined, ctx: BgmLoader): Promise<void> {
  try {
    await RouletteBgmManager.load(name || null, ctx.loadBgmBlob);
  } catch (e) {
    console.warn("[Bgm] failed to preload", e);
  }
}
