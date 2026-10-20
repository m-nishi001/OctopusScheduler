import { ref } from 'vue';

/**
 * 「同時に1つだけ実行する操作」の実行中の印と、失敗の通知を1か所にまとめる。
 * ボタンの連打で二重に送らない・失敗しても必ず元に戻す、を呼び出しごとに書かなくて済む。
 *
 * @param onError 操作が失敗したときに呼ぶ(利用者への通知など)。例外は外に出さない
 * @returns `busy` は実行中の操作のキー(無ければ null)。`run` は実行中でなければ実行して true / 失敗か実行中なら false を返す
 */
export function useBusy<K>(onError: (error: unknown) => void) {
  const busy = ref<K | null>(null);

  async function run(key: K, task: () => Promise<void>): Promise<boolean> {
    if (busy.value !== null) return false;
    busy.value = key;
    try {
      await task();
      return true;
    } catch (error) {
      onError(error);
      return false;
    } finally {
      busy.value = null;
    }
  }

  return { busy, run };
}
