import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from '../use-polling';

describe('usePolling', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('指定間隔で繰り返し実行し、stopで止まる', async () => {
        const fn = vi.fn(async () => {});
        const p = usePolling(fn, 1000);
        p.start();
        await vi.advanceTimersByTimeAsync(3000);
        expect(fn).toHaveBeenCalledTimes(3);
        p.stop();
        await vi.advanceTimersByTimeAsync(3000);
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('immediate:true なら開始直後に1回実行する', async () => {
        const fn = vi.fn(async () => {});
        const p = usePolling(fn, 1000, { immediate: true });
        p.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);
        p.stop();
    });

    it('asyncFnが例外を投げてもポーリングを継続しonErrorに通知する', async () => {
        const onError = vi.fn();
        let n = 0;
        const fn = vi.fn(async () => {
            n++;
            if (n <= 2) throw new Error('network');
        });
        const p = usePolling(fn, 1000, { onError });
        p.start();
        await vi.advanceTimersByTimeAsync(4000);
        expect(fn).toHaveBeenCalledTimes(4);
        expect(onError).toHaveBeenCalledTimes(2);
        p.stop();
    });

    it('onError自体が例外を投げても継続する', async () => {
        const fn = vi.fn(async () => {
            throw new Error('x');
        });
        const p = usePolling(fn, 1000, {
            onError: () => {
                throw new Error('y');
            },
        });
        p.start();
        await vi.advanceTimersByTimeAsync(3000);
        expect(fn).toHaveBeenCalledTimes(3);
        p.stop();
    });

    it('実行中にstopされたら次回を予約しない', async () => {
        let resolve!: () => void;
        const fn = vi.fn(() => new Promise<void>((r) => (resolve = r)));
        const p = usePolling(fn, 1000, { immediate: true });
        p.start();
        await vi.advanceTimersByTimeAsync(0);
        p.stop();
        resolve();
        await vi.advanceTimersByTimeAsync(5000);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
