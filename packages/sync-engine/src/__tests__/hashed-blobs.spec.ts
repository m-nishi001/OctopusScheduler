import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { FixedConcurrencyPolicy } from "@octopus/infrastructures/testing";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { BlobRecordStore } from "../blob-record-store";
import { blobRecordSyncTarget, textBlobRecordRemote } from "../blob-record-sync-target";
import {
  downloadMissingBlobs,
  hashBlob,
  HashedBlobStore,
  uploadMissingBlobs,
  withHashedBlobs,
} from "../hashed-blobs";
import type { HashedBlobRemote } from "../hashed-blobs";
import { SyncRunner } from "../sync-runner";

const blobOf = (text: string) => new Blob([text], { type: "text/plain" });

/** サーバーの代わり。ファイルは hash → Blob、一覧はテキスト1件。 */
function makeServer() {
  const files = new Map<string, Blob>();
  const server = { files, text: null as string | null, puts: [] as string[], gets: [] as string[], existsCalls: 0 };
  const remote: HashedBlobRemote = {
    exists: async (hashes) => {
      server.existsCalls++;
      return hashes.filter((h) => files.has(h));
    },
    put: async (hash, blob) => {
      server.puts.push(hash);
      files.set(hash, blob);
    },
    get: async (hash) => {
      server.gets.push(hash);
      return files.get(hash) ?? null;
    },
  };
  return { server, remote };
}

type Item = { id: string; hash: string };
const hashesOf = (items: Item[]) => items.map((i) => i.hash);

describe("hashBlob", () => {
  it("同じ内容なら同じ32桁、違えば違う値", async () => {
    expect(await hashBlob(blobOf("a"))).toMatch(/^[0-9a-f]{32}$/);
    expect(await hashBlob(blobOf("a"))).toBe(await hashBlob(blobOf("a")));
    expect(await hashBlob(blobOf("a"))).not.toBe(await hashBlob(blobOf("b")));
  });
});

describe("uploadMissingBlobs / downloadMissingBlobs", () => {
  let local: HashedBlobStore;
  beforeEach(async () => {
    await new LocalStorageService("test-blobs", "Blobs").clear();
    local = new HashedBlobStore("test-blobs", "Blobs");
  });

  it("足りないものだけを上げる(確認は1回、同じハッシュは1回)", async () => {
    const { server, remote } = makeServer();
    for (const h of ["h1", "h2", "h3"]) await local.put(h, blobOf(h));
    server.files.set("h2", blobOf("h2"));
    const result = await uploadMissingBlobs(local, remote, ["h1", "h2", "h3", "h1"]);
    expect(result).toEqual({ uploaded: 2, skipped: 1 });
    expect(server.existsCalls).toBe(1);
    expect(server.puts.sort()).toEqual(["h1", "h3"]);
  });

  it("手元に無いものを上げようとしたら例外", async () => {
    const { remote } = makeServer();
    await expect(uploadMissingBlobs(local, remote, ["nope"])).rejects.toThrow(/not on this device/);
  });

  it("手元に無いものだけを取ってくる。サーバーにも無いものは missing に返す", async () => {
    const { server, remote } = makeServer();
    await local.put("h1", blobOf("h1"));
    server.files.set("h1", blobOf("h1"));
    server.files.set("h2", blobOf("h2"));
    const result = await downloadMissingBlobs(local, remote, ["h1", "h2", "h3"]);
    expect(result).toEqual({ downloaded: 1, missing: ["h3"] });
    expect(server.gets.sort()).toEqual(["h2", "h3"]);
    expect(await local.has("h2")).toBe(true);
  });

  it("collectGarbage は、参照されていない古いファイルだけを消す(書いたばかりのものは残す)", async () => {
    await local.put("keep", blobOf("1"));
    await local.put("old", blobOf("2"));
    expect(await local.collectGarbage(new Set(["keep"]), 60_000)).toBe(0);
    expect(await local.collectGarbage(new Set(["keep"]), 60_000, Date.now() + 61_000)).toBe(1);
    expect(await local.has("keep")).toBe(true);
    expect(await local.has("old")).toBe(false);
  });
});

describe("withHashedBlobs(上げる → 一覧 → 取ってくる)", () => {
  let store: BlobRecordStore<Item[]>;
  let blobs: HashedBlobStore;
  let runner: SyncRunner;

  beforeEach(async () => {
    await new LocalStorageService("test-db", "List").clear();
    await new LocalStorageService("test-db", "ListBlobs").clear();
    store = new BlobRecordStore<Item[]>("test-db", "List");
    blobs = new HashedBlobStore("test-db", "ListBlobs");
    runner = new SyncRunner(new FixedConcurrencyPolicy(5));
  });

  function target(server: ReturnType<typeof makeServer>) {
    const record = blobRecordSyncTarget(
      "list",
      store,
      textBlobRecordRemote<Item[]>({
        read: async () => server.server.text,
        write: async (text) => {
          // 一覧が書かれる時点で、参照先のファイルはもうサーバーにある
          for (const h of hashesOf(JSON.parse(text).data)) expect(server.server.files.has(h)).toBe(true);
          server.server.text = text;
        },
      })
    );
    return withHashedBlobs(record, { local: blobs, remote: server.remote, hashesOf });
  }

  it("端末A: ファイルを先に上げてから一覧を送る。端末B: 一覧を受け取り、ファイルを取ってくる", async () => {
    const server = makeServer();
    const hash = await hashBlob(blobOf("img"));
    await blobs.put(hash, blobOf("img"));
    await store.update(() => [{ id: "1", hash }]);
    expect((await runner.run([target(server)])).results[0].result).toBe("pushed");
    expect(server.server.puts).toEqual([hash]);

    // 端末B(別の保存先)
    await new LocalStorageService("test-db", "List").clear();
    await new LocalStorageService("test-db", "ListBlobs").clear();
    expect((await runner.run([target(server)])).results[0].result).toBe("pulled");
    expect(await blobs.has(hash)).toBe(true);
    expect((await store.read())!.data).toEqual([{ id: "1", hash }]);
  });

  it("一覧が同じ(skip)でも、取りこぼしたファイルは次の同期で取ってくる", async () => {
    const server = makeServer();
    server.server.files.set("h1", blobOf("x"));
    await store.update(() => [{ id: "1", hash: "h1" }]);
    await blobs.put("h1", blobOf("x"));
    await runner.run([target(server)]);
    await new LocalStorageService("test-db", "ListBlobs").clear(); // ファイルだけ失った
    const result = (await runner.run([target(server)])).results[0];
    expect(result.result).toBe("skipped");
    expect(await blobs.has("h1")).toBe(true);
  });

  it("ファイルの取得が通信で失敗したら、その対象は失敗になる(次の同期でやり直す)", async () => {
    const server = makeServer();
    await store.update(() => [{ id: "1", hash: "h1" }]);
    server.server.files.set("h1", blobOf("x"));
    await blobs.put("h1", blobOf("x"));
    await runner.run([target(server)]);
    await new LocalStorageService("test-db", "ListBlobs").clear();
    server.remote.get = async () => {
      throw new Error("offline");
    };
    const result = (await runner.run([target(server)])).results[0];
    expect(result).toMatchObject({ result: "failed", error: "offline" });
  });

  it("上げるのに失敗したら、一覧は送らない", async () => {
    const server = makeServer();
    server.remote.put = async () => {
      throw new Error("boom");
    };
    await blobs.put("h1", blobOf("x"));
    await store.update(() => [{ id: "1", hash: "h1" }]);
    const result = (await runner.run([target(server)])).results[0];
    expect(result).toMatchObject({ result: "failed", action: "push" });
    expect(server.server.text).toBeNull();
  });
});
