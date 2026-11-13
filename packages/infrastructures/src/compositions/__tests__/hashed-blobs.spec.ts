import { describe, expect, it } from "vitest";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import { createHashedBlobStore, hashBytes, MAX_BLOB_BYTES, MissingBlobsError } from "../hashed-blobs";
import { StorageModule } from "../storage-paths";

const A = "a".repeat(32);
const B = "b".repeat(32);
const C = "c".repeat(32);
const dataUrl = (payload = "QUJD", mime = "image/png") => `data:${mime};base64,${payload}`;
/** 一覧のデータは `{ hash }[]`(テスト用)。 */
const hashesOf = (data: unknown): string[] => (Array.isArray(data) ? data.map((d) => d.hash) : []);
const record = (...hashes: string[]) => JSON.stringify({ updatedAt: 1, data: hashes.map((hash) => ({ hash })) });

const store = createHashedBlobStore(StorageModule.Quiz);

function deps() {
  return { storage: new InMemoryKeyValueStorage() };
}

describe("ハッシュのファイル置き場", () => {
  it("保存したファイルを、存在確認と取得で確かめられる(同じハッシュは上書き)", async () => {
    const d = deps();
    await store.put(d, { hash: A, dataUrl: dataUrl("QUJD") });
    await store.put(d, { hash: A, dataUrl: dataUrl("QUJD") });
    expect(await store.exists(d, { hashes: [A, B] })).toEqual({ existing: [A] });
    expect(await store.get(d, { hash: A })).toEqual({ dataUrl: dataUrl("QUJD") });
    expect(await store.get(d, { hash: B })).toEqual({ dataUrl: null });
  });

  it("形の違うハッシュ・データURLでないもの・大きすぎるものは断る", async () => {
    const d = deps();
    await expect(store.put(d, { hash: "../x", dataUrl: dataUrl() })).rejects.toThrow(/Invalid blob hash/);
    await expect(store.put(d, { hash: A, dataUrl: "plain" })).rejects.toThrow(/data URL/);
    await expect(store.put(d, { hash: A, dataUrl: dataUrl("A".repeat(41_943_044)) })).rejects.toThrow(/too large/);
    await expect(store.exists(d, { hashes: ["x"] })).rejects.toThrow(/Invalid blob hash/);
  });
});

describe("一覧の保存(saveRecord)", () => {
  it("前の一覧にあって新しい一覧に無いハッシュのファイルだけを消す", async () => {
    const d = deps();
    for (const h of [A, B]) await store.put(d, { hash: h, dataUrl: dataUrl() });
    await store.saveRecord(d, { fileName: "list.json", json: record(A, B) }, hashesOf);
    await store.saveRecord(d, { fileName: "list.json", json: record(B) }, hashesOf);
    expect((await store.exists(d, { hashes: [A, B] })).existing).toEqual([B]);
    expect((await store.getRecord(d, { fileName: "list.json" })).json).toBe(record(B));
  });

  it("どの一覧にもまだ載っていない新しいファイル(別の端末が上げた直後)は消さない", async () => {
    const d = deps();
    for (const h of [A, B, C]) await store.put(d, { hash: h, dataUrl: dataUrl() });
    await store.saveRecord(d, { fileName: "list.json", json: record(A) }, hashesOf);
    await store.saveRecord(d, { fileName: "list.json", json: record() }, hashesOf);
    expect((await store.exists(d, { hashes: [A, B, C] })).existing.sort()).toEqual([B, C]);
  });

  it("参照先のファイルが無い一覧は、書かずに断る(前の一覧のまま)", async () => {
    const d = deps();
    await store.put(d, { hash: A, dataUrl: dataUrl() });
    await store.saveRecord(d, { fileName: "list.json", json: record(A) }, hashesOf);
    await expect(store.saveRecord(d, { fileName: "list.json", json: record(A, B) }, hashesOf)).rejects.toBeInstanceOf(MissingBlobsError);
    expect((await store.getRecord(d, { fileName: "list.json" })).json).toBe(record(A));
    expect((await store.exists(d, { hashes: [A] })).existing).toEqual([A]);
  });

  it("一覧の形が違うテキストは断る。一覧ごとに別々に管理する", async () => {
    const d = deps();
    await expect(store.saveRecord(d, { fileName: "list.json", json: "[1]" }, hashesOf)).rejects.toThrow(/updatedAt, data/);
    await store.put(d, { hash: A, dataUrl: dataUrl() });
    await store.saveRecord(d, { fileName: "one.json", json: record(A) }, hashesOf);
    await store.saveRecord(d, { fileName: "two.json", json: record() }, hashesOf);
    // two.json の前の一覧(無し)には A が無いので、one.json が参照する A は消えない
    expect((await store.exists(d, { hashes: [A] })).existing).toEqual([A]);
  });

  it("連続した保存(ロックあり)でも、最後に書いた一覧がそのまま結果になる", async () => {
    const d = { ...deps(), lock: { withLock: async <T,>(_k: string, _t: number, fn: () => Promise<T> | T) => fn() } };
    for (const h of [A, B, C]) await store.put(d, { hash: h, dataUrl: dataUrl() });
    await Promise.all([
      store.saveRecord(d, { fileName: "list.json", json: record(A, B, C) }, hashesOf),
    ]);
    await store.saveRecord(d, { fileName: "list.json", json: record(C) }, hashesOf);
    expect((await store.exists(d, { hashes: [A, B, C] })).existing).toEqual([C]);
  });
});

describe("バイナリのファイル(putBytes / getBytes。Cloudflare の /blobs)", () => {
  const bytesOf = (...values: number[]) => new Uint8Array(values);
  const everyByte = Uint8Array.from({ length: 256 }, (_, i) => i);

  it("バイト列のまま保存して、そのまま取り出せる(同じ種類つき)。存在確認にも載る", async () => {
    const d = deps();
    const hash = await hashBytes(everyByte);
    await store.putBytes(d, { hash, bytes: everyByte, mime: "audio/mpeg" });
    const got = await store.getBytes(d, { hash });
    expect(Array.from(got!.bytes)).toEqual(Array.from(everyByte));
    expect(got!.mime).toBe("audio/mpeg");
    expect(await store.exists(d, { hashes: [hash, A] })).toEqual({ existing: [hash] });
    expect(await store.getBytes(d, { hash: A })).toBeNull();
  });

  it("ハッシュが中身と違えば断り、保存しない(同じハッシュの正しいファイルも上書きしない)", async () => {
    const d = deps();
    const good = bytesOf(1, 2, 3);
    const hash = await hashBytes(good);
    await expect(store.putBytes(d, { hash, bytes: bytesOf(9, 9, 9), mime: "image/png" })).rejects.toThrow(/does not match/);
    expect(await store.getBytes(d, { hash })).toBeNull();
    await store.putBytes(d, { hash, bytes: good, mime: "image/png" });
    await expect(store.putBytes(d, { hash, bytes: bytesOf(9, 9, 9), mime: "image/png" })).rejects.toThrow(/does not match/);
    expect(Array.from((await store.getBytes(d, { hash }))!.bytes)).toEqual([1, 2, 3]);
  });

  it("30MB を超えるものと、形の違うハッシュは断る", async () => {
    const d = deps();
    await expect(store.putBytes(d, { hash: A, bytes: new Uint8Array(MAX_BLOB_BYTES + 1), mime: "video/mp4" })).rejects.toThrow(/too large/);
    await expect(store.putBytes(d, { hash: "../x", bytes: bytesOf(1) })).rejects.toThrow(/Invalid blob hash/);
    await expect(store.getBytes(d, { hash: "../x" })).rejects.toThrow(/Invalid blob hash/);
  });

  it("上限ちょうどの大きさは受け付ける", async () => {
    const d = deps();
    const big = new Uint8Array(MAX_BLOB_BYTES);
    await store.putBytes(d, { hash: await hashBytes(big), bytes: big, mime: "video/mp4" });
    expect((await store.getBytes(d, { hash: await hashBytes(big) }))!.bytes.byteLength).toBe(MAX_BLOB_BYTES);
  });

  it("種類(MIME)が変な形なら、中身を問わない種類にする", async () => {
    const d = deps();
    const hash = await hashBytes(bytesOf(7));
    await store.putBytes(d, { hash, bytes: bytesOf(7), mime: "text/html; <script>" });
    expect((await store.getBytes(d, { hash }))!.mime).toBe("application/octet-stream");
  });

  it("バイナリで入れたファイルは、GAS 用のデータURLの入口からも同じ中身で読める(保存先は共通)", async () => {
    const d = deps();
    const hash = await hashBytes(bytesOf(65, 66, 67));
    await store.putBytes(d, { hash, bytes: bytesOf(65, 66, 67), mime: "image/png" });
    expect(await store.get(d, { hash })).toEqual({ dataUrl: "data:image/png;base64,QUJD" });
  });
});
