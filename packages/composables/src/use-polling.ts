import { getCurrentInstance, onUnmounted, ref } from 'vue';

/**
 * 任意の非同期関数を指定間隔でポーリング実行するcomposable
 * @param asyncFn 実行する非同期関数
 * @param intervalMs ポーリング間隔（ミリ秒）
 * @param options immediate: trueで即時実行 / onError: asyncFnが例外を投げた時の通知
 *
 * asyncFnが例外を投げてもポーリングは止めず、次回の実行を予約し続ける
 * (一時的な通信失敗で投影端末や参加者端末の更新が永久に止まるのを防ぐ)。
 */
export function usePolling(
    asyncFn: () => Promise<void>,
    intervalMs: number,
    options?: { immediate?: boolean; onError?: (error: unknown) => void }
) {
    const isActive = ref(false);
    let timer: number | ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
        if (!isActive.value) return;
        try {
            await asyncFn();
        } catch (error) {
            try {
                options?.onError?.(error);
            } catch {
                // onErrorの失敗でポーリングを止めない
            }
        }
        if (isActive.value) {
            timer = setTimeout(run, intervalMs);
        }
    };

    const start = () => {
        if (isActive.value) return;
        isActive.value = true;
        if (options?.immediate) run();
        else timer = setTimeout(run, intervalMs);
    };

    const stop = () => {
        isActive.value = false;
        if (timer) clearTimeout(timer);
        timer = null;
    };

    if (getCurrentInstance()) {
        onUnmounted(stop);
    }

    return { start, stop, isActive };
}
