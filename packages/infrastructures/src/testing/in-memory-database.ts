import type { DataBaseFactory, DataCollection, IDataBase } from "../interfaces/database";

export class InMemoryDataBase implements IDataBase {
  private readonly collections = new Map<string, unknown[][]>();

  constructor(private readonly dataBaseId: string | null) {}

  /** テスト用: シート/コレクションの中身を直接投入する。 */
  seed(name: string, rows: unknown[][]): void {
    this.collections.set(name, rows);
  }

  listCollections(): string[] {
    if (!this.dataBaseId) return [];
    return Array.from(this.collections.keys());
  }

  getCollection(name: string): DataCollection | null {
    const rows = this.collections.get(name);
    if (!rows) return null;
    return { name, rows };
  }
}

export function createInMemoryDataBaseFactory(): {
  factory: DataBaseFactory;
  byId: Map<string, InMemoryDataBase>;
} {
  const byId = new Map<string, InMemoryDataBase>();
  const factory: DataBaseFactory = (dataBaseId) => {
    const key = dataBaseId ?? "__null__";
    if (!byId.has(key)) {
      byId.set(key, new InMemoryDataBase(dataBaseId));
    }
    return byId.get(key)!;
  };
  return { factory, byId };
}
