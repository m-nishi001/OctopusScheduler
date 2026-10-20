import { effectScope } from "vue";
import { useAudio } from "@octopus/composables/use-audio";

/**
 * ルーレットの BGM。抽選の進行・ルーレットの部品・確変の演出が同じ1曲を扱うので、
 * ページ全体で1つの再生を共有する（複数の部品が別々に鳴らして重ならないように）。
 * 特定の画面の寿命に縛られないよう、画面とは別のスコープで作る。
 */
let shared: ReturnType<typeof useAudio> | null = null;

function sharedAudio(): ReturnType<typeof useAudio> {
  shared ??= effectScope(true).run(() => useAudio())!;
  return shared;
}

/** ルーレットの BGM の再生・停止。 */
export function useRouletteAudio() {
  const audio = sharedAudio();

  /** 前の曲を止めて、渡された曲をループで鳴らす。曲が無ければ何もしない。失敗しても演出は止めない。 */
  const startBgm = async (bgm?: Blob | null): Promise<void> => {
    if (!bgm) return;
    try {
      await audio.stop();
      await audio.load(bgm);
      await audio.play({ isRepeat: true });
    } catch (err) {
      console.warn("[RouletteAudio] failed to start BGM", err);
    }
  };

  return {
    startBgm,
    stopBgmAudio: () => audio.stop(),
    bgmAutoplayBlocked: audio.autoplayBlocked,
    tryResumeBgm: () => audio.tryResume(),
    isBgmPlaying: audio.isPlaying,
    currentBgmSrc: audio.currentSrc,
  };
}
