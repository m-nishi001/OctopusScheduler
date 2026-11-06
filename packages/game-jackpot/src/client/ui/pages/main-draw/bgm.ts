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

/** 抽選中の BGM を止める。失敗しても演出は止めない。 */
export async function stopBgm(): Promise<void> {
  try {
    await RouletteBgmManager.stop();
  } catch (e) {
    console.warn("[Bgm] failed to stop", e);
  }
}

/** 次に鳴らすBGMを先に読み込んでおく(失敗しても演出は止めない)。 */
export async function preloadBgm(name: string | null | undefined, ctx: BgmLoader): Promise<void> {
  try {
    await RouletteBgmManager.load(name || null, ctx.loadBgmBlob);
  } catch (e) {
    console.warn("[Bgm] failed to preload", e);
  }
}
