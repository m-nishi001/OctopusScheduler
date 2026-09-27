import { getCurrentInstance, onUnmounted } from "vue";

/**
 * 呼び出しをdebounceするcomposable。連続した trigger() 呼び出しを
 * delayMs 経過後の1回にまとめる。バックグラウンド同期で、連続した
 * ローカル編集(入力中のキー操作、連続したドラッグ操作など)を
 * 1回のプッシュにまとめる用途を想定。
 *
 * @param fn debounce対象の関数
 * @param delayMs 最後の trigger() から fn() 実行までの待機時間(ミリ秒)
 */
export function useDebouncedCallback(
  fn: () => void | Promise<void>,
  delayMs: number
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const trigger = () => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  };

  /** 待機中の呼び出しがあれば、待たずに即座に実行する。 */
  const flush = () => {
    if (!timer) return;
    cancel();
    fn();
  };

  if (getCurrentInstance()) {
    onUnmounted(cancel);
  }

  return { trigger, flush, cancel };
}
