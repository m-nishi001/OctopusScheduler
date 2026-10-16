import type { DrawContext } from "./draw-context";
import { RouletteBgmManager } from "./roulette/roulette-bgm-manager";

type BgmLoader = Pick<DrawContext, "loadBgmBlob">;

/** BGMの再生に失敗しても演出は止めない。 */
export async function playBgm(assetId: string | null | undefined, ctx: BgmLoader): Promise<void> {
  try {
    await RouletteBgmManager.playAsset(assetId || null, ctx.loadBgmBlob);
  } catch (e) {
    console.warn("[Bgm] failed to play", e);
  }
}

export async function stopBgm(): Promise<void> {
  try {
    await RouletteBgmManager.stop();
  } catch (e) {
    console.warn("[Bgm] failed to stop", e);
  }
}

/** 次に鳴らすBGMを先に読み込んでおく(失敗しても演出は止めない)。 */
export async function preloadBgm(assetId: string | null | undefined, ctx: BgmLoader): Promise<void> {
  try {
    await RouletteBgmManager.load(assetId || null, ctx.loadBgmBlob);
  } catch (e) {
    console.warn("[Bgm] failed to preload", e);
  }
}
