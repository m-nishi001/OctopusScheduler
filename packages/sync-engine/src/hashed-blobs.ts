/**
 * 内容のハッシュを名前にした、中身の変わらないファイル(画像・音声など)の同期。
 *
 * 一覧(レコード)が正で、ファイルは一覧が参照するハッシュで指す。ファイルは中身が変わらないので、
 * 新旧の比較も競合も無く、「あるか・無いか」だけを見る。やることは2つだけ。
 * - サーバーに無いものを上げる(一覧を送る前)
 * - 手元に無いものを取ってくる(一覧を受け取ったあと)
 * ファイルから一覧の項目を作る道筋は無い(だから、消した項目が戻ってくることは無い)。
 * メンバー写真(accounts の photo-upload / member-photo-cache)と同じ考え方を、汎用にしたもの。
 */
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { SyncSnapshot, SyncTarget } from "./sync-target";
import { mapPool } from "./pool/promise-pool";
import type { PoolOptions } from "./pool/promise-pool";

/** ハッシュの形(SHA-256 の先頭32桁・16進の小文字)。サーバーも同じ形だけを受け付ける。 */
export const BLOB_HASH_PATTERN = /^[0-9a-f]{32}$/;

/** Blob の中身(`arrayBuffer` が無い環境では FileReader で読む)。 */
function readBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("failed to read blob"));
    reader.readAsArrayBuffer(blob);
  });
}

/** Blob の内容のハッシュ(SHA-256 の先頭32桁)。同じ内容なら、いつでも同じ値。 */
export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await readBytes(blob));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** サーバー側のファイル置き場。 */
export interface HashedBlobRemote {
  /** 渡したハッシュのうち、サーバーにあるもの。通信の失敗は例外で伝える(「無い」と取り違えないため)。 */
  exists(hashes: string[]): Promise<string[]>;
  put(hash: string, blob: Blob): Promise<void>;
  /** サーバーに無ければ null。 */
  get(hash: string): Promise<Blob | null>;
}

/** 手元のファイル置き場。 */
export interface HashedBlobLocal {
  has(hash: string): Promise<boolean>;
  get(hash: string): Promise<Blob | null>;
  put(hash: string, blob: Blob): Promise<void>;
}

/** この端末(IndexedDB)の、ハッシュをキーにしたファイル置き場。 */
export class HashedBlobStore implements HashedBlobLocal {
  private opened: LocalStorageService | null = null;

  /** 最初に使うときまで、データベースを開かない(localforage は作った時点でデータベースを開き始めるので、ファイルを使わない画面では何も開かない)。 */
  constructor(
    private readonly dbName: string,
    private readonly storeName: string
  ) {}

  private get storage(): LocalStorageService {
    return (this.opened ??= new LocalStorageService(this.dbName, this.storeName));
  }

  async has(hash: string): Promise<boolean> {
    return (await this.storage.getWithMeta<Blob>(hash)) !== null;
  }

  async get(hash: string): Promise<Blob | null> {
    return (await this.storage.get<Blob>(hash)) ?? null;
  }

  /** 中身は変わらないので、あれば書かない。 */
  async put(hash: string, blob: Blob): Promise<void> {
    if (!(await this.has(hash))) await this.storage.save(hash, blob);
  }

  /**
   * 参照されていないファイルを消す。いま書いている最中(一覧にはまだ載っていない)のものを消さないよう、
   * 書いてから `graceMs` 以内のものは残す。
   */
  async collectGarbage(referenced: ReadonlySet<string>, graceMs: number = 10 * 60 * 1000, now: number = Date.now()): Promise<number> {
    const stale: string[] = [];
    for (const key of await this.storage.keys()) {
      if (referenced.has(key)) continue;
      const stored = await this.storage.getWithMeta<Blob>(key);
      if (stored && now - stored.updatedAt >= graceMs) stale.push(key);
    }
    await this.storage.removeMultiple(stale);
    return stale.length;
  }

  clear(): Promise<void> {
    return this.storage.clear();
  }
}

const unique = (hashes: readonly string[]): string[] => [...new Set(hashes)];

/** サーバーに無いファイルだけを上げる(確認は1回)。手元に無いハッシュがあれば例外(一覧が先に進んでしまわないように)。 */
export async function uploadMissingBlobs(
  local: HashedBlobLocal,
  remote: HashedBlobRemote,
  hashes: readonly string[],
  options?: PoolOptions
): Promise<{ uploaded: number; skipped: number }> {
  const wanted = unique(hashes);
  if (wanted.length === 0) return { uploaded: 0, skipped: 0 };
  const existing = new Set(await remote.exists(wanted));
  const missing = wanted.filter((h) => !existing.has(h));
  await mapPool(
    missing,
    async (hash) => {
      const blob = await local.get(hash);
      if (!blob) throw new Error(`blob ${hash} is not on this device`);
      await remote.put(hash, blob);
    },
    options
  );
  return { uploaded: missing.length, skipped: wanted.length - missing.length };
}

/** 手元に無いファイルだけを取ってくる。サーバーにも無かったものは `missing` に返す(例外にはしない)。通信の失敗は例外。 */
export async function downloadMissingBlobs(
  local: HashedBlobLocal,
  remote: HashedBlobRemote,
  hashes: readonly string[],
  options?: PoolOptions
): Promise<{ downloaded: number; missing: string[] }> {
  const wanted = unique(hashes);
  const absent: string[] = [];
  for (const hash of wanted) if (!(await local.has(hash))) absent.push(hash);
  const results = await mapPool(
    absent,
    async (hash) => {
      const blob = await remote.get(hash);
      if (blob) await local.put(hash, blob);
      return blob !== null;
    },
    options
  );
  return {
    downloaded: results.filter(Boolean).length,
    missing: absent.filter((_, i) => !results[i]),
  };
}

export interface HashedBlobSync<T> {
  local: HashedBlobLocal & { collectGarbage?(referenced: ReadonlySet<string>): Promise<number> };
  remote: HashedBlobRemote;
  /** 一覧のデータが参照しているハッシュ。 */
  hashesOf(data: T): string[];
  pool?: PoolOptions;
}

/**
 * 一覧の同期対象に、ファイルの同期を組み合わせる。順番は「足りないファイルを上げる → 一覧を送る/受け取る → 足りないファイルを取ってくる」。
 * 取ってくるのは、一覧の同期の結果(送った・受け取った・何もしなかった)に関わらず毎回行う
 * (前回、取ってくる途中で止まっていても、次の同期で続きから揃う)。そのあと、一覧に載っていない手元のファイルを片づける。
 */
export function withHashedBlobs<T>(target: SyncTarget<T, T>, blobs: HashedBlobSync<T>): SyncTarget<T, T> {
  return {
    ...target,
    push: async (snapshot: SyncSnapshot<T>) => {
      await uploadMissingBlobs(blobs.local, blobs.remote, blobs.hashesOf(snapshot.data), blobs.pool);
      await target.push(snapshot);
    },
    afterSync: async () => {
      const current = await target.getLocal();
      if (!current) return;
      const hashes = blobs.hashesOf(current.data);
      await downloadMissingBlobs(blobs.local, blobs.remote, hashes, blobs.pool);
      await blobs.local.collectGarbage?.(new Set(hashes));
    },
  };
}
