import type { IKeyValueRepository } from "../../../key-value-repository";

export class InMemoryKeyValueRepository implements IKeyValueRepository {
  private readonly store = new Map<string, string>();

  get(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }
}
