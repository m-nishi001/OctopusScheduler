/**
 * Cloudflare: ファイル(画像・音声・動画)をバイナリのまま送受信する `/blobs/<module>/<hash>`。
 *
 * - `PUT`: 本文がファイルそのもの。サイズの上限と、ハッシュと中身の一致を確かめてから保存する。
 * - `GET`: ファイルそのものを返す。ハッシュは中身で決まり変わらないので、長期キャッシュ(`immutable`)と ETag を付ける。
 * 認可は `/rpc` と同じ管理者のセッション(トークンは `Authorization: Bearer <token>`)。
 * ハッシュの形の検査・上限・保存は、GAS 側と共有する `createHashedBlobStore`(compositions/hashed-blobs.ts)に任せる。
 */
import { DomainError } from "../interfaces/domain-error";
import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import { BLOB_HASH_PATTERN, MAX_BLOB_BYTES } from "../compositions/hashed-blobs";
import type { createHashedBlobStore } from "../compositions/hashed-blobs";

export const BLOBS_PATH_PREFIX = "/blobs/";

/** 長期キャッシュ。ファイルの名前(ハッシュ)が中身で決まり、同じ名前で中身が変わらないので安全。 */
export const BLOB_CACHE_CONTROL = "public, max-age=31536000, immutable";

type HashedBlobStore = ReturnType<typeof createHashedBlobStore>;

export interface BlobRouteDeps {
  /** セッショントークンが有効な管理者のものか。 */
  isAdmin(token: string | null): Promise<boolean>;
  /** リクエストごとの保存先。 */
  storage(): IKeyValueStorage;
  /** `<module>`(URL の2つ目の要素)ごとのファイル置き場。ここに無い名前は 404。 */
  stores: Readonly<Record<string, HashedBlobStore>>;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

const text = (status: number, message: string): Response =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** `/blobs/<module>/<hash>` のリクエストを処理する。 */
export function createBlobRoute(deps: BlobRouteDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const [module, hash, ...rest] = new URL(request.url).pathname.slice(BLOBS_PATH_PREFIX.length).split("/");
    const store = module ? deps.stores[module] : undefined;
    if (!store || !hash || rest.length > 0 || !BLOB_HASH_PATTERN.test(hash)) return text(404, "Not found");
    if (request.method !== "PUT" && request.method !== "GET") return text(405, "Method not allowed");

    if (!(await deps.isAdmin(bearerToken(request)))) return text(401, "Unauthorized");

    const storeDeps = { storage: deps.storage() };
    try {
      if (request.method === "GET") return await get(store, storeDeps, hash, request);
      return await put(store, storeDeps, hash, request);
    } catch (error) {
      if (error instanceof DomainError) return text(400, error.message);
      throw error;
    }
  };
}

async function put(store: HashedBlobStore, deps: { storage: IKeyValueStorage }, hash: string, request: Request): Promise<Response> {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BLOB_BYTES) return text(413, `Blob is too large (max ${MAX_BLOB_BYTES} bytes)`);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BLOB_BYTES) return text(413, `Blob is too large (max ${MAX_BLOB_BYTES} bytes)`);
  await store.putBytes(deps, { hash, bytes, mime: request.headers.get("Content-Type") });
  return new Response(null, { status: 204 });
}

async function get(store: HashedBlobStore, deps: { storage: IKeyValueStorage }, hash: string, request: Request): Promise<Response> {
  const etag = `"${hash}"`;
  const found = await store.getBytes(deps, { hash });
  if (!found) return text(404, "Not found");
  const headers = {
    "Cache-Control": BLOB_CACHE_CONTROL,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return new Response(found.bytes, { headers: { ...headers, "Content-Type": found.mime } });
}
