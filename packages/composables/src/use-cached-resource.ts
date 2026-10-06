import { ref, type Ref } from "vue";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

/** useCachedResource が必要とする最小のストレージ。LocalStorageService(IndexedDB)がそのまま満たす。 */
export interface CachedResourceStorage {
  get<T>(id: string): Promise<T | undefined>;
  save<T>(id: string, data: T): Promise<void>;
}

export interface CachedResourceOptions<T> {
  /** キャッシュのキー。画面/データ種別ごとに一意にする。 */
  key: string;
  /** 通信を伴う取得処理。 */
  fetcher: () => Promise<T>;
  /** キャッシュも通信結果もまだ無い間の値。 */
  initial: T;
  /** テスト用に差し替え可能。省略時は IndexedDB(LocalStorageService)。 */
  storage?: CachedResourceStorage;
}

let defaultStorage: CachedResourceStorage | null = null;
function getDefaultStorage(): CachedResourceStorage {
  // 遅延生成: localforage を使わない環境(テスト等)で import だけして落ちないようにする
  if (!defaultStorage) defaultStorage = new LocalStorageService("octopus-cache", "resources");
  return defaultStorage;
}

/**
 * stale-while-revalidate 型のデータ取得。
 * 1) IndexedDB のキャッシュがあれば即座に表示 → 2) 背景で通信して最新に差し替え、キャッシュも更新する。
 * 通信待ちで画面が空になる時間をなくし、書き込み(mutate)はローカルへ先に反映して体感遅延を隠す。
 * キャッシュは端末ローカルのIndexedDBなので、KV等の書き込み回数制限には影響しない。
 */
export function useCachedResource<T>(options: CachedResourceOptions<T>) {
  const storage = options.storage ?? getDefaultStorage();
  const data = ref(options.initial) as Ref<T>;
  /** 表示できるデータが一切無い間だけ true(スケルトン表示用)。 */
  const loading = ref(true);
  /** 背景の通信中。 */
  const refreshing = ref(false);
  const error = ref<Error | null>(null);

  // 書き込み(set/mutate)のたびに進める。通信中に書き込みが入った場合、古い取得結果で上書きしないために使う。
  let version = 0;

  const persist = async (value: T) => {
    try {
      await storage.save(options.key, value);
    } catch (e) {
      // キャッシュ失敗は致命的ではない(次回は通信のみになる)
      console.warn(`[useCachedResource] failed to persist cache: ${options.key}`, e);
    }
  };

  const set = async (value: T) => {
    version++;
    data.value = value;
    await persist(value);
  };

  /** 通信して最新化する。失敗時は表示中のデータを保ち error にだけ記録する。 */
  const refresh = async () => {
    const startedAt = version;
    refreshing.value = true;
    try {
      const fresh = await options.fetcher();
      error.value = null;
      if (startedAt === version) {
        data.value = fresh;
        await persist(fresh);
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      refreshing.value = false;
      loading.value = false;
    }
  };

  /** キャッシュ→通信の順に読み込む。画面の初期表示で1回呼ぶ。 */
  const load = async () => {
    try {
      const cached = await storage.get<T>(options.key);
      if (cached !== undefined) {
        data.value = cached;
        loading.value = false;
      }
    } catch (e) {
      console.warn(`[useCachedResource] failed to read cache: ${options.key}`, e);
    }
    await refresh();
  };

  /**
   * 楽観的更新。先にローカルへ反映して即座に画面へ出し、commit(通信)が失敗したら元に戻して例外を投げる。
   */
  const mutate = async (apply: (current: T) => T, commit: () => Promise<void>) => {
    const snapshot = data.value;
    await set(apply(snapshot));
    try {
      await commit();
    } catch (e) {
      await set(snapshot);
      throw e;
    }
  };

  return { data, loading, refreshing, error, load, refresh, set, mutate };
}
