/**
 * TTL付きキャッシュの抽象化(GASでは CacheService)。
 */
export interface ICacheRepository {
  get(key: string): string | null;
  put(key: string, value: string, ttlSeconds: number): void;
  remove(key: string): void;
}

export const ICacheRepositoryToken = Symbol("ICacheRepository");
