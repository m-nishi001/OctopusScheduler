/**
 * 同時に走らせる数に上限を設けた並列実行(Promise プール)。写真の縮小・送信のように、
 * 何十件もの非同期処理を「6並列ずつ」流したいときに使う。
 *
 * - 結果は入力と同じ順番で返す。
 * - 1件でも失敗したら、新しい処理は始めず、実行中のものが終わるのを待ってから最初のエラーを投げる
 *   (名簿への書き込みの前に全部成功しているかを確かめたいので、一部だけ成功した状態を黙って返さない)。
 * - サーバーが回数の上限で断ってきたとき({@link RateLimitedError} = HTTP 429)は、`Retry-After` の分だけ
 *   待って同じ処理をやり直す。待っている間は他の処理も新しく始めない(全体の速度を落とす)。
 *   やり直す処理は、同じ内容を何度送っても結果が変わらないものに限る。
 */
import { RateLimitedError } from "@octopus/infrastructures/interfaces";

export const DEFAULT_POOL_CONCURRENCY = 6;
export const DEFAULT_RATE_LIMIT_RETRIES = 5;

export interface PoolOptions {
  /** 同時に走らせる数。既定は6。 */
  concurrency?: number;
  /** 429 のときにやり直す最大回数(処理1件あたり)。超えたら 429 のエラーを投げる。既定は5。 */
  maxRateLimitRetries?: number;
  /** 429 で待つ時間の上限(ms)。サーバーの指示が長すぎても、これ以上は待たない。既定は60秒。 */
  maxWaitMs?: number;
  /** 待つ処理。テストで差し替える。 */
  sleep?: (ms: number) => Promise<void>;
  /** 現在時刻(ms)。テストで差し替える。 */
  now?: () => number;
  /** 429 で待つとき(待ち時間ms)に呼ぶ。進捗表示などに使う。 */
  onRateLimited?: (waitMs: number) => void;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `items` の各要素に `task` を、同時実行数の上限つきで適用する。 */
export async function mapPool<T, R>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<R>,
  options: PoolOptions = {}
): Promise<R[]> {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_POOL_CONCURRENCY));
  const maxRetries = options.maxRateLimitRetries ?? DEFAULT_RATE_LIMIT_RETRIES;
  const maxWaitMs = options.maxWaitMs ?? 60_000;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  const results = new Array<R>(items.length);
  let next = 0;
  let failure: { error: unknown } | null = null;
  /** 429 を受けたあと、この時刻までは新しい処理を始めない(全員で待つ)。 */
  let pausedUntil = 0;

  const runWithRetry = async (item: T, index: number): Promise<R> => {
    for (let attempt = 0; ; attempt++) {
      const wait = pausedUntil - now();
      if (wait > 0) await sleep(wait);
      try {
        return await task(item, index);
      } catch (error) {
        if (!(error instanceof RateLimitedError) || attempt >= maxRetries) throw error;
        const waitMs = Math.min(error.retryAfterMs, maxWaitMs);
        pausedUntil = Math.max(pausedUntil, now() + waitMs);
        options.onRateLimited?.(waitMs);
      }
    }
  };

  const worker = async (): Promise<void> => {
    while (failure === null && next < items.length) {
      const index = next++;
      try {
        results[index] = await runWithRetry(items[index], index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failure !== null) throw (failure as { error: unknown }).error;
  return results;
}
