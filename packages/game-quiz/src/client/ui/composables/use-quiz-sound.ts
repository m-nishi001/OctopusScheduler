import { getCurrentScope, onScopeDispose } from "vue";
import { useSound } from "@octopus/composables/use-sound";

/**
 * クイズの画面のBGM(イントロ・出題中・正解・ランキング・景品)。音の中心(`SoundSystem`)の `screen` チャンネルで鳴らす。
 * 曲は画面の設定に埋め込まれた Blob なので、曲の識別(`key`)は呼ぶ側が「クイズ + 画面の種類」で決める。
 * 止めるのは、自分が流した曲だけ。画面が切り替わるときの止め方は、router の `beforeResolve`(quiz-bgm-guard)。
 * 再生は失敗しても例外にならない(画面の進行は止めない)。再生の完了は待たない。
 */
export function useQuizSound() {
  const { screen } = useSound();
  /** この画面が流している曲の `key`。 */
  let current: string | null = null;
  /** 画面を離れた印。離れたあとに(設定の読み込みが遅れて)届いた曲は、鳴らさない。 */
  let disposed = false;
  if (getCurrentScope()) onScopeDispose(() => (disposed = true));
  return {
    /** 曲を流す(`loop` なら止めるまで繰り返す。既定は1回だけ)。曲が無ければ何もしない。 */
    async play(key: string, bgm: Blob | null | undefined, options: { loop?: boolean } = {}): Promise<void> {
      if (!bgm || disposed) return;
      current = key;
      await screen.play({ key, load: async () => bgm }, { loop: options.loop ?? false });
    },
    /** この画面が流した曲を止める(まだ読み込み中なら、鳴らさない)。流していなければ何もしない。 */
    stop(): Promise<void> {
      return current ? screen.stop({ key: current }) : Promise.resolve();
    },
  };
}
