import { injectable } from "tsyringe";
import type { ICacheRepository } from "../interfaces/cache-repository";

@injectable()
export class GasCacheRepository implements ICacheRepository {
  private readonly cache = CacheService.getScriptCache();

  get(key: string): string | null {
    return this.cache.get(key);
  }

  put(key: string, value: string, ttlSeconds: number): void {
    this.cache.put(key, value, ttlSeconds);
  }

  remove(key: string): void {
    this.cache.remove(key);
  }
}
