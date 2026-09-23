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

  get(key: string): string | null {
    return this.scalars.has(key) ? this.scalars.get(key)! : null;
  }

  set(key: string, value: string): void {
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

  putText(key: string, content: string, mimeType: string): StoredItemMeta {
    return this.upsert(key, Buffer.from(content, "utf8").toString("base64"), mimeType);
  }

  putBinary(key: string, contentBase64: string, mimeType: string): StoredItemMeta {
    return this.upsert(key, contentBase64, mimeType);
  }

  getContent(key: string): StoredItemContent | null {
    const item = this.items.get(key);
    if (!item) return null;
    return { meta: this.toMeta(item), contentBase64: item.contentBase64 };
  }

  getContentAsText(key: string): string | null {
    const item = this.items.get(key);
    if (!item) return null;
    return Buffer.from(item.contentBase64, "base64").toString("utf8");
  }

  stat(key: string): StoredItemMeta | null {
    const item = this.items.get(key);
    return item ? this.toMeta(item) : null;
  }

  listByPrefix(prefix: string): StoredItemMeta[] {
    return Array.from(this.items.values())
      .filter((item) => item.key.startsWith(prefix))
      .map((item) => this.toMeta(item));
  }

  delete(key: string): StoredItemMeta | null {
    const item = this.items.get(key);
    if (!item) return null;
    this.items.delete(key);
    return this.toMeta(item);
  }
}
