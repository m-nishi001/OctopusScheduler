import { ref, onUnmounted } from 'vue';

/**
 * 任意の非同期関数を指定間隔でポーリング実行するcomposable
 * @param asyncFn 実行する非同期関数
 * @param intervalMs ポーリング間隔（ミリ秒）
 * @param options immediate: trueで即時実行
 */
export function usePolling(
    asyncFn: () => Promise<void>,
    intervalMs: number,
    options?: { immediate?: boolean }
) {
    const isActive = ref(false);
    let timer: number | ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
        if (!isActive.value) return;
        await asyncFn();
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

    onUnmounted(stop);

    return { start, stop, isActive };
}
