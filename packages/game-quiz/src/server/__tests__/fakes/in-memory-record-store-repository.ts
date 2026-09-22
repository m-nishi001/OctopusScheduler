import type {
  IRecordStoreRepository,
  RecordStoreRepositoryFactory,
} from "@octopus/infrastructures/interfaces";

export class InMemoryRecordStoreRepository implements IRecordStoreRepository {
  private readonly collections = new Map<string, unknown[][]>();

  constructor(private readonly recordStoreId: string | null) {}

  seed(name: string, rows: unknown[][]): void {
    this.collections.set(name, rows);
  }

  listCollections(): string[] {
    if (!this.recordStoreId) return [];
    return Array.from(this.collections.keys());
  }

  replaceCollection(name: string, rows: unknown[][]): void {
    this.collections.set(name, rows);
  }

  getCollection(name: string): { name: string; rows: unknown[][] } | null {
    const rows = this.collections.get(name);
    if (!rows) return null;
    return { name, rows };
  }

  deleteCollection(name: string): void {
    this.collections.delete(name);
  }

  appendRows(name: string, rows: unknown[][]): void {
    const existing = this.collections.get(name) ?? [];
    this.collections.set(name, [...existing, ...rows]);
  }

  findRowIndexById(name: string, idColumnIndex = 1): Map<string, number> {
    const result = new Map<string, number>();
    const rows = this.collections.get(name) ?? [];
    rows.forEach((row, i) => {
      const id = String(row[idColumnIndex - 1] ?? "");
      if (id !== "") result.set(id, i + 1);
    });
    return result;
  }

  updateRowsById(): { updated: number; missingIds: string[] } {
    return { updated: 0, missingIds: [] };
  }
}

export function createInMemoryRecordStoreRepositories(): {
  factory: RecordStoreRepositoryFactory;
  byId: Map<string, InMemoryRecordStoreRepository>;
} {
  const byId = new Map<string, InMemoryRecordStoreRepository>();
  const factory: RecordStoreRepositoryFactory = (recordStoreId) => {
    const key = recordStoreId ?? "__null__";
    if (!byId.has(key)) {
      byId.set(key, new InMemoryRecordStoreRepository(recordStoreId));
    }
    return byId.get(key)!;
  };
  return { factory, byId };
}
