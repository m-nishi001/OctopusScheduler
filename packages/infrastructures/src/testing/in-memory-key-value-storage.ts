import type {
  IKeyValueStorage,
  StoredItemContent,
  StoredItemMeta,
} from "../interfaces/key-value-storage";

interface StoredItem {
  key: string;
  mimeType: string;
  contentBase64: string;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryKeyValueStorage implements IKeyValueStorage {
  private readonly scalars = new Map<string, string>();
  private readonly items = new Map<string, StoredItem>();

  async get(key: string): Promise<string | null> {
    return this.scalars.has(key) ? this.scalars.get(key)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.scalars.set(key, value);
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
