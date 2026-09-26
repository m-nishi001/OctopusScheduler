import { injectable } from "tsyringe";
import type {
  IKeyValueStorage,
  StoredItemContent,
  StoredItemMeta,
} from "../interfaces/key-value-storage";
import { currentEnv } from "./request-context";

const SCALAR_PREFIX = "__scalars__/";

/**
 * IKeyValueStorage の Cloudflare 実装(R2)。
 *
 * スカラー値(get/set)・内容付きの値(putText等)のどちらも同一バケットに
 * 保存する。スカラー値はキー衝突を避けるため専用の名前空間に置く。
 * R2は list({prefix})/head()/カスタムメタデータをネイティブに持つため、
 * listByPrefix/statが自然に対応する。
 */
@injectable()
export class CloudflareKeyValueStorage implements IKeyValueStorage {
  private bucket(): R2Bucket {
    return currentEnv().BUCKET;
  }

  async get(key: string): Promise<string | null> {
    const obj = await this.bucket().get(SCALAR_PREFIX + key);
    return obj ? await obj.text() : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.bucket().put(SCALAR_PREFIX + key, value);
  }

  private toMeta(key: string, obj: R2Object): StoredItemMeta {
    return {
      key,
      mimeType: obj.httpMetadata?.contentType ?? "application/octet-stream",
      size: obj.size,
      createdAt: obj.uploaded.toISOString(),
      updatedAt: obj.uploaded.toISOString(),
    };
  }

  async putText(key: string, content: string, mimeType: string): Promise<StoredItemMeta> {
    const obj = await this.bucket().put(key, content, { httpMetadata: { contentType: mimeType } });
    return this.toMeta(key, obj);
  }

  async putBinary(key: string, contentBase64: string, mimeType: string): Promise<StoredItemMeta> {
    const bytes = Buffer.from(contentBase64, "base64");
    const obj = await this.bucket().put(key, bytes, { httpMetadata: { contentType: mimeType } });
    return this.toMeta(key, obj);
  }

  async getContent(key: string): Promise<StoredItemContent | null> {
    const obj = await this.bucket().get(key);
    if (!obj) return null;
    const buf = Buffer.from(await obj.arrayBuffer());
    return { meta: this.toMeta(key, obj), contentBase64: buf.toString("base64") };
  }

  async getContentAsText(key: string): Promise<string | null> {
    const obj = await this.bucket().get(key);
    return obj ? await obj.text() : null;
  }

  async stat(key: string): Promise<StoredItemMeta | null> {
    const obj = await this.bucket().head(key);
    return obj ? this.toMeta(key, obj) : null;
  }

  async listByPrefix(prefix: string): Promise<StoredItemMeta[]> {
    const { objects } = await this.bucket().list({ prefix });
    return objects.map((obj) => this.toMeta(obj.key, obj));
  }

  async delete(key: string): Promise<StoredItemMeta | null> {
    const meta = await this.stat(key);
    if (!meta) return null;
    await this.bucket().delete(key);
    return meta;
  }
}
