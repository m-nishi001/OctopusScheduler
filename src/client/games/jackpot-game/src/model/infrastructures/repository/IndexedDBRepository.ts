export class IndexedDBRepository {
  async save<T>(store: string, value: T): Promise<void> {
    void store;
    void value;
    // TODO: 実装
  }
  async load<T>(store: string, key: string): Promise<T | undefined> {
    void store;
    void key;
    // TODO: 実装
    return undefined;
  }
}
