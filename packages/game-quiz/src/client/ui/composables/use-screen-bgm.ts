import { onScopeDispose } from "vue";
import { useAudio } from "@octopus/composables";

/**
 * 画面を表示している間、BGMを1回だけ流す(ループしない)。画面を離れたら止める。
 * 再生の完了は待たない(自動再生が止められても、画面の進行は止まらない)。失敗しても例外にはしない。
 */
export function useScreenBgm() {
  const { load, play } = useAudio();
  /** 画面を離れた印。読み込みの途中で離れたら、そのあと鳴らさない。 */
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  /** 曲を読み込んで1回だけ流す。曲が無ければ何もしない。 */
  const playOnce = async (bgm: Blob | null | undefined): Promise<void> => {
    if (!bgm) return;
    try {
      await load(bgm);
      if (disposed) return;
      void play();
    } catch (e) {
      console.warn("[ScreenBgm] failed to play", e);
    }
  };

  return { playOnce };
}
