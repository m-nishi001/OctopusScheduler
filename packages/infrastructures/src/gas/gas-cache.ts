import { injectable } from "tsyringe";
import type { ICache } from "../interfaces/cache";

@injectable()
export class GasCache implements ICache {
  private readonly cache = CacheService.getScriptCache();

  async get(key: string): Promise<string | null> {
    return this.cache.get(key);
  }

  async put(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.cache.put(key, value, ttlSeconds);
  }

  async remove(key: string): Promise<void> {
    this.cache.remove(key);
  }
}
