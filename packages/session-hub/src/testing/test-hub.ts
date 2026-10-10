/**
 * テスト用のセッションハブ一式(インメモリ)。単体テスト・マルチ端末シミュレータ・
 * 無料枠の予算テストで共有する。
 *
 * - 時刻は FakeClock で進める(実時間に依存しない)
 * - KV/キャッシュの読み書き回数を数える(クォータ予算の検証用)
 * - ロックは同一キーを直列化する(ILock と同じ意味)
 */
import { InMemoryCache, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import type { ICache, IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import {
  createCachePresenceStore,
  createKvSessionIndex,
  createKvSessionRepo,
} from "../server/engine/session-repo";
import type { ServiceDeps } from "../server/engine/session-service";

export interface Clock {
  now: () => number;
  advance(ms: number): void;
}

export class FakeClock implements Clock {
  constructor(private ms = 1_700_000_000_000) {}
  now = (): number => this.ms;
  advance(ms: number): void {
    this.ms += ms;
  }
}

export interface OpCounts {
  kvGet: number;
  kvSet: number;
  cacheGet: number;
  cachePut: number;
  lock: number;
}

class CountingKv extends InMemoryKeyValueStorage {
  constructor(private readonly counts: OpCounts) {
    super();
  }
  override async get(key: string): Promise<string | null> {
    this.counts.kvGet++;
    return super.get(key);
  }
  override async set(key: string, value: string): Promise<void> {
    this.counts.kvSet++;
    return super.set(key, value);
  }
}

class CountingCache extends InMemoryCache {
  constructor(private readonly counts: OpCounts) {
    super();
  }
  override async get(key: string): Promise<string | null> {
    this.counts.cacheGet++;
    return super.get(key);
  }
  override async put(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.counts.cachePut++;
    return super.put(key, value, ttlSeconds);
  }
}

export interface TestHub {
  deps: ServiceDeps;
  clock: Clock;
  counts: OpCounts;
  storage: IKeyValueStorage;
  cache: ICache;
  resetCounts(): void;
}

export function createTestHub(options: { clock?: Clock } = {}): TestHub {
  const clock = options.clock ?? new FakeClock();
  const counts: OpCounts = { kvGet: 0, kvSet: 0, cacheGet: 0, cachePut: 0, lock: 0 };
  const storage = new CountingKv(counts);
  const cache = new CountingCache(counts);
  let idCounter = 0;
  const chains = new Map<string, Promise<unknown>>();

  const deps: ServiceDeps = {
    index: createKvSessionIndex(storage),
    repoFor: (id) => createKvSessionRepo(storage, id),
    presenceFor: (id) => createCachePresenceStore(cache, id, clock.now),
    withLock: async <T>(key: string, _timeoutMs: number, fn: () => Promise<T> | T): Promise<T> => {
      counts.lock++;
      const prev = chains.get(key) ?? Promise.resolve();
      const run = prev.then(() => fn());
      chains.set(
        key,
        run.catch(() => undefined)
      );
      return run;
    },
    now: clock.now,
    // 16進文字のみ(参加コード生成が16進を前提にするため、実際の UUID に近い形にする)
    newId: () => `${(++idCounter).toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-${(idCounter * 7919).toString(16).padStart(12, "0")}`,
    newToken: () => `tok-${(++idCounter).toString(16)}-${(idCounter * 104729).toString(16)}`,
  };

  return {
    deps,
    clock,
    counts,
    storage,
    cache,
    resetCounts: () => {
      counts.kvGet = counts.kvSet = counts.cacheGet = counts.cachePut = counts.lock = 0;
    },
  };
}
