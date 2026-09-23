import { injectable } from "tsyringe";
import type { ICache } from "../interfaces/cache";

@injectable()
export class GasCache implements ICache {
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
