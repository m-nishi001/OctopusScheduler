/**
 * TTL付きキャッシュの抽象化(GASでは CacheService)。
 */
export interface ICache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
  remove(key: string): Promise<void>;
}

export const ICacheToken = Symbol("ICache");
