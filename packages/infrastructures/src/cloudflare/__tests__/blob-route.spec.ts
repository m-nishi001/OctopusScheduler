import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import { createHashedBlobStore, hashBytes, MAX_BLOB_BYTES } from "../../compositions/hashed-blobs";
import { StorageModule } from "../../compositions/storage-paths";
import { BLOB_CACHE_CONTROL, createBlobRoute } from "../blob-route";

const TOKEN = "admin-token";
const ORIGIN = "https://example.test";

function setup() {
  const storage = new InMemoryKeyValueStorage();
  const route = createBlobRoute({
    isAdmin: async (token) => token === TOKEN,
    storage: () => storage,
    stores: { [StorageModule.Quiz]: createHashedBlobStore(StorageModule.Quiz) },
  });
  const url = (hash: string, module: string = StorageModule.Quiz) => `${ORIGIN}/blobs/${module}/${hash}`;
  const send = (method: string, hash: string, init: { token?: string | null; body?: BodyInit; headers?: Record<string, string>; module?: string } = {}) =>
    route(
      new Request(url(hash, init.module), {
        method,
        body: init.body,
        headers: {
          ...(init.token === null ? {} : { Authorization: `Bearer ${init.token ?? TOKEN}` }),
          ...init.headers,
        },
      })
    );
  return { storage, send };
}

const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);

describe("/blobs/<module>/<hash>", () => {
  it("バイナリで PUT して GET すると、同じバイト列と種類が返る(往復)", async () => {
    const { send } = setup();
    const hash = await hashBytes(bytes);
    const put = await send("PUT", hash, { body: bytes, headers: { "Content-Type": "audio/mpeg" } });
    expect(put.status).toBe(204);
    const got = await send("GET", hash);
    expect(got.status).toBe(200);
    expect(got.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(Array.from(new Uint8Array(await got.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("GET は長期キャッシュ(immutable)と ETag を付け、同じ ETag の再要求には 304 を返す", async () => {
    const { send } = setup();
    const hash = await hashBytes(bytes);
    await send("PUT", hash, { body: bytes });
    const got = await send("GET", hash);
    expect(got.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(BLOB_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
    expect(got.headers.get("ETag")).toBe(`"${hash}"`);
    const again = await send("GET", hash, { headers: { "If-None-Match": `"${hash}"` } });
    expect(again.status).toBe(304);
    expect(again.headers.get("Cache-Control")).toBe(BLOB_CACHE_CONTROL);
  });

  it("ハッシュが中身と違う PUT は 400 で断り、保存しない", async () => {
    const { send, storage } = setup();
    const res = await send("PUT", "a".repeat(32), { body: bytes });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/does not match/);
    expect((await send("GET", "a".repeat(32))).status).toBe(404);
    expect(await storage.listByPrefix("")).toEqual([]);
  });

  it("上限(30MB)を超える PUT は 413。申告(Content-Length)が超えていれば、本文を読まずに断る", async () => {
    const { send } = setup();
    const declared = await send("PUT", "a".repeat(32), { body: bytes, headers: { "Content-Length": String(MAX_BLOB_BYTES + 1) } });
    expect(declared.status).toBe(413);
    const big = new Uint8Array(MAX_BLOB_BYTES + 1);
    expect((await send("PUT", await hashBytes(big), { body: big })).status).toBe(413);
  });

  it("管理者のトークンが無い・違う場合は 401(PUT も GET も、保存はされない)", async () => {
    const { send, storage } = setup();
    const hash = await hashBytes(bytes);
    expect((await send("PUT", hash, { body: bytes, token: null })).status).toBe(401);
    expect((await send("PUT", hash, { body: bytes, token: "other" })).status).toBe(401);
    expect(await storage.listByPrefix("")).toEqual([]);
    await send("PUT", hash, { body: bytes });
    expect((await send("GET", hash, { token: null })).status).toBe(401);
    expect((await send("GET", hash, { token: "other" })).status).toBe(401);
  });

  it("無いファイルは 404。知らないモジュール・形の違うハッシュも 404、PUT / GET 以外は 405", async () => {
    const { send } = setup();
    expect((await send("GET", "b".repeat(32))).status).toBe(404);
    expect((await send("GET", "b".repeat(32), { module: "accounts" })).status).toBe(404);
    expect((await send("GET", "../x")).status).toBe(404);
    expect((await send("DELETE", "b".repeat(32))).status).toBe(405);
  });
});
