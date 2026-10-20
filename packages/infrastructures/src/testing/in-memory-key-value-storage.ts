import {
  StorageCapacityError,
  utf8ByteLength,
  type IKeyValueStorage,
  type StoredItemContent,
  type StoredItemMeta,
} from "../interfaces/key-value-storage";

interface StoredItem {
  key: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
  updatedAt: string;
}

/** GAS の ScriptProperty と同じ容量の上限(1 値 9KB・全体 500KB)。テストで上限の挙動を再現する。 */
export const GAS_LIKE_LIMITS = { maxScalarBytes: 9000, maxTotalScalarBytes: 500 * 1024 } as const;

export interface InMemoryStorageOptions {
  /** 文字列値 1 件の上限(バイト)。省略時は無制限。 */
  maxScalarBytes?: number;
  /** 文字列値全体(キー + 値)の上限(バイト)。省略時は無制限。 */
  maxTotalScalarBytes?: number;
}

/** テスト用の `IKeyValueStorage`(メモリ上)。値の大きさ・合計の上限を指定でき、GAS の容量制限を再現できる。 */
export class InMemoryKeyValueStorage implements IKeyValueStorage {
  private readonly scalars = new Map<string, string>();
  private readonly items = new Map<string, StoredItem>();
  readonly maxScalarBytes?: number;
  private readonly maxTotalScalarBytes?: number;

  constructor(options: InMemoryStorageOptions = {}) {
    this.maxScalarBytes = options.maxScalarBytes;
    this.maxTotalScalarBytes = options.maxTotalScalarBytes;
  }

  /** 文字列値全体の使用量(バイト)。 */
  scalarBytesUsed(): number {
    let total = 0;
    for (const [key, value] of this.scalars) total += utf8ByteLength(key) + utf8ByteLength(value);
    return total;
  }

  async get(key: string): Promise<string | null> {
    return this.scalars.has(key) ? this.scalars.get(key)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    const bytes = utf8ByteLength(value);
    if (this.maxScalarBytes !== undefined && bytes > this.maxScalarBytes) {
      throw new StorageCapacityError(`1値の上限を超えました(${key}: ${bytes}バイト)`);
    }
    if (this.maxTotalScalarBytes !== undefined) {
      const previous = this.scalars.get(key);
      const delta = utf8ByteLength(key) + bytes - (previous === undefined ? 0 : utf8ByteLength(key) + utf8ByteLength(previous));
      if (this.scalarBytesUsed() + delta > this.maxTotalScalarBytes) {
        throw new StorageCapacityError("合計の容量の上限を超えました");
      }
    }
    this.scalars.set(key, value);
  }

  async deleteScalar(key: string): Promise<void> {
    this.scalars.delete(key);
  }

  async deleteScalarsByPrefix(prefix: string): Promise<number> {
    const keys = Array.from(this.scalars.keys()).filter((key) => key.startsWith(prefix));
    for (const key of keys) this.scalars.delete(key);
    return keys.length;
  }

  private toMeta(item: StoredItem): StoredItemMeta {
    return {
      key: item.key,
      mimeType: item.mimeType,
      size: Buffer.byteLength(item.contentBase64, "base64"),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private upsert(key: string, contentBase64: string, mimeType: string): StoredItemMeta {
    const now = new Date().toISOString();
    const existing = this.items.get(key);
    const item: StoredItem = {
      key,
      mimeType,
      contentBase64,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.items.set(key, item);
    return this.toMeta(item);
  }

  async putText(key: string, content: string, mimeType: string): Promise<StoredItemMeta> {
    return this.upsert(key, Buffer.from(content, "utf8").toString("base64"), mimeType);
  }

  async putBinary(key: string, contentBase64: string, mimeType: string): Promise<StoredItemMeta> {
    return this.upsert(key, contentBase64, mimeType);
  }

  async getContent(key: string): Promise<StoredItemContent | null> {
    const item = this.items.get(key);
    if (!item) return null;
    return { meta: this.toMeta(item), contentBase64: item.contentBase64 };
  }

  async getContentAsText(key: string): Promise<string | null> {
    const item = this.items.get(key);
    if (!item) return null;
    return Buffer.from(item.contentBase64, "base64").toString("utf8");
  }

  async stat(key: string): Promise<StoredItemMeta | null> {
    const item = this.items.get(key);
    return item ? this.toMeta(item) : null;
  }

  async listByPrefix(prefix: string): Promise<StoredItemMeta[]> {
    return Array.from(this.items.values())
      .filter((item) => item.key.startsWith(prefix))
      .map((item) => this.toMeta(item));
  }

  async delete(key: string): Promise<StoredItemMeta | null> {
    const item = this.items.get(key);
    if (!item) return null;
    this.items.delete(key);
    return this.toMeta(item);
  }
}
