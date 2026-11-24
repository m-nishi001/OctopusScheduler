import type { SoundSource, SoundSystem } from "@octopus/client-common/audio/sound-system";
import type { DrawContext } from "./draw-context";

/** 景品の当選BGM(確変の当選BGMも含む)を鳴らすのに必要なもの。音の中心の `screen` チャンネルで、1回だけ鳴らす。 */
type BgmDeps = Pick<DrawContext, "loadBgmBlob"> & { sound: Pick<SoundSystem, "screen"> };

/** 素材(名前)から曲を作る。中身が無いときは、読み込みで例外(再生側が警告して、演出は止めない)。 */
function sourceOf(name: string, ctx: Pick<DrawContext, "loadBgmBlob">): SoundSource {
  return {
    key: name,
    load: async () => {
      const blob = await ctx.loadBgmBlob(name);
      if (!blob) throw new Error(`BGM の素材がありません: ${name}`);
      return blob;
    },
  };
}

/** BGMの再生に失敗しても演出は止めない(`play` は例外にならない)。 */
export async function playBgm(name: string | null | undefined, ctx: BgmDeps): Promise<void> {
  if (!name) return;
  await ctx.sound.screen.play(sourceOf(name, ctx));
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
 * 曲が無い(空)ときは何もしない(同じチャンネルで流れている景品抽選BGMを、巻き込んで止めないように)。
 */
export async function playWinningBgm(name: string | null | undefined, stopSec: number, ctx: BgmDeps): Promise<void> {
  if (!name) return;
  const fadeMs = Math.min(WINNING_BGM_FADE_MS, Math.max(0, stopSec * 1000));
  setTimeout(() => {
    void ctx.sound.screen.stop({ key: name, fadeMs });
  }, fadeStartDelayMs(stopSec, fadeMs));
  await playBgm(name, ctx);
}

/** 次に鳴らすBGMを先に読み込んでおく(失敗しても演出は止めない)。 */
export async function preloadBgm(name: string | null | undefined, ctx: BgmDeps): Promise<void> {
  if (!name) return;
  await ctx.sound.screen.preload(sourceOf(name, ctx));
}
