/**
 * サーバー側: 「一覧(レコード)1件 + 内容のハッシュを名前にしたファイル」の保存。
 *
 * 一覧が正で、ファイル(画像・音声など)はハッシュで参照される。ファイルは中身が変わらないので、
 * 保存・確認・取得だけがあり、削除は「一覧から外れたものを、一覧を書くときに消す」だけ
 * (メンバーの名簿と写真の `orphanPhotos` と同じ形)。
 * - 一覧を書くのはロックの中。前の一覧が参照していて新しい一覧が参照していないハッシュだけを消す。
 *   別の端末が上げた直後の(まだどの一覧にも載っていない)ファイルは、前の一覧にも無いので消えない。
 * - 一覧が参照するファイルが無いまま書くことは無い(ロックの中で確かめ、足りなければ書かずに断る)。
 *   別の端末の一覧の保存で消えたファイルを、確認のあとに指してしまう場合の安全弁。
 */
import { DomainError } from "../interfaces/domain-error";
import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { ILock } from "../interfaces/lock";
import { createDriveAssets } from "./drive-assets";
import { StorageKind, storagePath, type StorageModuleName } from "./storage-paths";

/** ハッシュの形(SHA-256 の先頭32桁・16進の小文字)。クライアントの `hashBlob` と同じ。 */
export const BLOB_HASH_PATTERN = /^[0-9a-f]{32}$/;
/** 1つのファイルの上限(デコード後のバイト数)。 */
export const MAX_BLOB_BYTES = 30 * 1024 * 1024;
/** `existsBlobs` で一度に確かめられる件数。 */
export const MAX_BLOBS_PER_EXISTS = 500;

const BLOB_FILE_NAME = "blob";
const LOCK_TIMEOUT_MS = 10_000;

/** 一覧が参照しているファイルが、サーバーに無い。リトライしても同じなので DomainError(次の同期でファイルを上げ直してから、また一覧を送る)。 */
export class MissingBlobsError extends DomainError {
  constructor(readonly hashes: string[]) {
    super(`Record refers to blobs that are not stored: ${hashes.join(", ")}`);
    this.name = "MissingBlobsError";
  }
}

export interface HashedBlobDeps {
  storage: IKeyValueStorage;
}

export interface RecordDeps extends HashedBlobDeps {
  /** 一覧の更新を直列化する。未指定なら排他しない(テスト用)。 */
  lock?: ILock;
}

function assertHashes(hashes: unknown, max: number): asserts hashes is string[] {
  if (!Array.isArray(hashes)) throw new DomainError("hashes is required");
  if (hashes.length > max) throw new DomainError(`Too many blobs requested (max ${max})`);
  for (const h of hashes) {
    if (typeof h !== "string" || !BLOB_HASH_PATTERN.test(h)) throw new DomainError(`Invalid blob hash: "${String(h)}"`);
  }
}

/** base64 をデコードしたあとのバイト数。 */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

const DATA_URL_HEADER = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/;

/**
 * あるモジュールの「ハッシュのファイル置き場」と、その一覧(レコード)の保存。
 * 各ゲームのエンドポイントは、これを1つ作って呼ぶだけにする。
 */
export function createHashedBlobStore(module: StorageModuleName) {
  const assets = createDriveAssets(module, StorageKind.Assets);

  const storedHashes = async (deps: HashedBlobDeps): Promise<Set<string>> =>
    new Set((await assets.listMetadata(deps)).map((m) => m.driveDataId));

  const removeBlobs = async (deps: HashedBlobDeps, hashes: string[]): Promise<void> => {
    await Promise.all(
      hashes.map(async (hash) => {
        const prefix = `${module}/${StorageKind.Assets}/${hash}_`;
        for (const item of await deps.storage.listByPrefix(prefix)) await deps.storage.delete(item.key);
      })
    );
  };

  const recordKey = (fileName: string): string => storagePath(module, StorageKind.Json, fileName);

  return {
    /** ファイルを保存する(同じハッシュなら同じ場所への上書き)。種類(MIME)とサイズだけを確かめる(書けるのは管理者のみなので、ハッシュと中身の一致は見ない)。 */
    async put(deps: HashedBlobDeps, args: { hash: string; dataUrl: string }): Promise<void> {
      assertHashes([args.hash], 1);
      const header = typeof args.dataUrl === "string" ? DATA_URL_HEADER.exec(args.dataUrl.slice(0, 200)) : null;
      if (!header) throw new DomainError("Blob must be a base64 data URL");
      if (decodedBytes(args.dataUrl.slice(header[0].length)) > MAX_BLOB_BYTES) {
        throw new DomainError(`Blob is too large (max ${MAX_BLOB_BYTES} bytes)`);
      }
      await assets.save(deps, {
        metadata: { driveDataId: args.hash, fileId: "", parentFolderId: "", lastUpdate: "" },
        fileName: BLOB_FILE_NAME,
        fileKind: header[1],
        fileDataUrl: args.dataUrl,
        uploadDate: "",
        parentFolderId: "",
      });
    },

    /** 渡したハッシュのうち、保存されているもの。保存先の一覧を1回だけ引く。 */
    async exists(deps: HashedBlobDeps, args: { hashes: string[] }): Promise<{ existing: string[] }> {
      assertHashes(args.hashes, MAX_BLOBS_PER_EXISTS);
      const stored = await storedHashes(deps);
      return { existing: [...new Set(args.hashes)].filter((h) => stored.has(h)) };
    },

    /** ファイルの中身(データURL)。保存されていなければ null。 */
    async get(deps: HashedBlobDeps, args: { hash: string }): Promise<{ dataUrl: string | null }> {
      assertHashes([args.hash], 1);
      const [item] = await deps.storage.listByPrefix(`${module}/${StorageKind.Assets}/${args.hash}_`);
      const data = item ? await assets.get(deps, item.key) : null;
      return { dataUrl: data?.fileDataUrl ?? null };
    },

    /** 保存してある一覧のテキストを、そのまま返す。まだ無ければ null。読み取りの失敗は例外(空と取り違えて実データを上書きされないため)。 */
    async getRecord(deps: HashedBlobDeps, args: { fileName: string }): Promise<{ json: string | null }> {
      return { json: await deps.storage.getContentAsText(recordKey(args.fileName)) };
    },

    /**
     * 一覧のテキスト(`{ updatedAt, data }`)を、ロックの中でそのまま保存する。
     * `hashesOf(data)` が一覧の参照するハッシュ。参照先のファイルが無ければ書かずに断り、
     * 前の一覧にあって新しい一覧に無いハッシュのファイルを消す。
     */
    async saveRecord(
      deps: RecordDeps,
      args: { fileName: string; json: string },
      hashesOf: (data: unknown) => string[]
    ): Promise<void> {
      const key = recordKey(args.fileName);
      const next = referencedHashes(args.json, hashesOf);
      if (!next) throw new DomainError("Record must be JSON of { updatedAt, data }");
      const run = async (): Promise<void> => {
        const previous = referencedHashes(await deps.storage.getContentAsText(key), hashesOf) ?? new Set<string>();
        const wanted = [...next];
        if (wanted.length > 0) {
          const stored = await storedHashes(deps);
          const missing = wanted.filter((h) => !stored.has(h));
          if (missing.length > 0) throw new MissingBlobsError(missing);
        }
        await deps.storage.putText(key, args.json, "application/json");
        await removeBlobs(deps, [...previous].filter((h) => !next.has(h)));
      };
      await (deps.lock ? deps.lock.withLock(`record:${key}`, LOCK_TIMEOUT_MS, run) : run());
    },
  };
}

/** 一覧のテキストが参照するハッシュ。`{ updatedAt, data }` として読めないときは null(無いテキストも null)。形の違うハッシュは無視せず例外にはしないが、集めるのは正しい形のものだけ。 */
function referencedHashes(text: string | null, hashesOf: (data: unknown) => string[]): Set<string> | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || !("data" in value)) return null;
  return new Set(hashesOf((value as { data: unknown }).data).filter((h) => BLOB_HASH_PATTERN.test(h)));
}
