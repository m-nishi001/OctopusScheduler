import type { ICache } from "../interfaces/cache";

export class InMemoryCache implements ICache {
  private readonly store = new Map<string, string>();

  get(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  put(key: string, value: string, _ttlSeconds: number): void {
    this.store.set(key, value);
  }

  remove(key: string): void {
    this.store.delete(key);
  }
}
