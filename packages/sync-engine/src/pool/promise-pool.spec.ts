import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "@octopus/infrastructures/interfaces";
import { mapPool } from "./promise-pool";

/** 手動で完了させられる処理。同時に走っている数を測る。 */
function gate() {
  let running = 0;
  let max = 0;
  const waiting: Array<() => void> = [];
  const task = async (n: number) => {
    running++;
    max = Math.max(max, running);
    await new Promise<void>((resolve) => waiting.push(resolve));
    running--;
    return n * 2;
  };
  return { task, maxRunning: () => max, running: () => running, release: () => waiting.shift()?.() };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mapPool", () => {
  it("同時に走る数は上限(既定6)を超えず、入力と同じ順に結果を返す", async () => {
    const g = gate();
    const done = mapPool(Array.from({ length: 20 }, (_, i) => i), g.task);
    await tick();
    expect(g.running()).toBe(6);
    for (let i = 0; i < 20; i++) {
      g.release();
      await tick();
    }
    expect(await done).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
    expect(g.maxRunning()).toBe(6);
  });

  it("同時実行数を指定でき、入力が上限より少なければその数だけ走る", async () => {
    const g = gate();
    const done = mapPool([1, 2, 3], g.task, { concurrency: 2 });
    await tick();
    expect(g.running()).toBe(2);
    for (let i = 0; i < 3; i++) {
      g.release();
      await tick();
    }
    await done;
    expect(g.maxRunning()).toBe(2);
    expect(await mapPool([], g.task)).toEqual([]);
  });

  it("1件失敗したら新しい処理は始めず、実行中のものを待ってから最初のエラーを投げる", async () => {
    const started: number[] = [];
    const task = async (n: number) => {
      started.push(n);
      await tick();
      if (n === 1) throw new Error("boom");
      return n;
    };
    await expect(mapPool([0, 1, 2, 3, 4, 5, 6, 7], task, { concurrency: 2 })).rejects.toThrow("boom");
    expect(started.length).toBeLessThan(8);
  });

  describe("429(回数の上限)", () => {
    const clock = () => {
      let t = 0;
      const slept: number[] = [];
      return {
        now: () => t,
        sleep: async (ms: number) => {
          slept.push(ms);
          t += ms;
        },
        slept,
      };
    };

    it("Retry-After の分だけ待って、同じ処理をやり直す", async () => {
      const c = clock();
      const calls = new Map<number, number>();
      const task = async (n: number) => {
        const count = (calls.get(n) ?? 0) + 1;
        calls.set(n, count);
        if (n === 1 && count <= 2) throw new RateLimitedError("Too many requests", 3000);
        return n;
      };
      const onRateLimited = vi.fn();
      expect(await mapPool([0, 1, 2], task, { ...c, onRateLimited })).toEqual([0, 1, 2]);
      expect(calls.get(1)).toBe(3);
      expect(onRateLimited).toHaveBeenCalledTimes(2);
      expect(c.slept).toContain(3000);
    });

    it("1件が429になると、ほかの処理も待ち時間が過ぎるまで新しく始めない", async () => {
      const c = clock();
      const startedAt: Record<number, number> = {};
      let limited = false;
      const task = async (n: number) => {
        if (n === 0 && !limited) {
          limited = true;
          throw new RateLimitedError("Too many requests", 5000);
        }
        startedAt[n] = c.now();
        return n;
      };
      await mapPool([0, 1, 2, 3], task, { ...c, concurrency: 1 });
      // 0 が断られたあと、1・2・3 は 5000ms 待ってから始まる
      expect(startedAt[1]).toBeGreaterThanOrEqual(5000);
      expect(startedAt[3]).toBeGreaterThanOrEqual(5000);
    });

    it("待ち時間は maxWaitMs で頭打ちになる", async () => {
      const c = clock();
      let calls = 0;
      const task = async () => {
        if (++calls === 1) throw new RateLimitedError("Too many requests", 600_000);
        return "ok";
      };
      await mapPool([1], task, { ...c, maxWaitMs: 2000 });
      expect(c.slept).toEqual([2000]);
    });

    it("やり直しの回数を超えたら、429 のエラーを投げる。429 以外のエラーはやり直さない", async () => {
      const c = clock();
      let calls = 0;
      const always429 = async () => {
        calls++;
        throw new RateLimitedError("Too many requests", 1);
      };
      await expect(mapPool([1], always429, { ...c, maxRateLimitRetries: 2 })).rejects.toBeInstanceOf(RateLimitedError);
      expect(calls).toBe(3);
      let other = 0;
      await expect(
        mapPool([1], async () => {
          other++;
          throw new Error("x");
        }, c)
      ).rejects.toThrow("x");
      expect(other).toBe(1);
    });
  });
});
