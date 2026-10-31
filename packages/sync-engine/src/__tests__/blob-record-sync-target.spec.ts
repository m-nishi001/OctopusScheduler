import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { FixedConcurrencyPolicy } from "@octopus/infrastructures/testing";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { BlobRecordStore } from "../blob-record-store";
import { blobRecordSyncTarget, parseBlobRecord, stringifyBlobRecord, textBlobRecordRemote } from "../blob-record-sync-target";
import { SyncRunner } from "../sync-runner";
import type { SyncSnapshot } from "../sync-target";

/** サーバーの代わりに、テキストをそのまま保存して返す。送信中に割り込めるよう、保存の前に待つ処理を差し込める。 */
function makeServer() {
  const server = {
    text: null as string | null,
    beforePut: undefined as undefined | (() => Promise<void>),
    puts: 0,
  };
  const remote = textBlobRecordRemote<string[]>({
    read: async () => server.text,
    write: async (text) => {
      server.puts++;
      await server.beforePut?.();
      server.text = text;
    },
  });
  return { server, remote };
}

describe("blobRecordSyncTarget", () => {
  let store: BlobRecordStore<string[]>;
  let runner: SyncRunner;

  beforeEach(async () => {
    await new LocalStorageService("test-db", "Blob").clear();
    store = new BlobRecordStore<string[]>("test-db", "Blob");
    runner = new SyncRunner(new FixedConcurrencyPolicy(5));
  });

  const sync = async (remote: ReturnType<typeof makeServer>["remote"]) => {
    const summary = await runner.run([blobRecordSyncTarget("list", store, remote)]);
    return summary.results[0];
  };

  it("push の途中に編集しても、その編集は失われず、次の同期でまた送られる", async () => {
    const { server, remote } = makeServer();
    await store.update(() => ["A"]);

    server.beforePut = async () => {
      server.beforePut = undefined;
      await store.update(() => ["B"]); // 送信の最中の編集
    };
    expect((await sync(remote)).result).toBe("pushed");
    expect((await store.read())!.data).toEqual(["B"]);
    expect(parseBlobRecord<string[]>(server.text)!.data).toEqual(["A"]);

    expect((await sync(remote)).result).toBe("pushed");
    expect(parseBlobRecord<string[]>(server.text)!.data).toEqual(["B"]);
    expect((await sync(remote)).result).toBe("skipped");
  });

  it("pull の途中に編集したら、書かずに戻り(skip)、その編集が次の同期で送られる", async () => {
    const { server, remote } = makeServer();
    server.text = stringifyBlobRecord({ data: ["remote"], updatedAt: Date.now() + 60_000 });
    await store.update(() => ["old"]);

    // 判定(リモートのほうが新しい)のあと、書く直前に編集が入る
    const racing = {
      ...remote,
      get: async () => {
        const snapshot = await remote.get();
        await store.update(() => ["edited"]);
        return snapshot;
      },
    };
    expect((await runner.run([blobRecordSyncTarget("list", store, racing)])).results[0].result).toBe("skipped");
    expect((await store.read())!.data).toEqual(["edited"]);
  });

  it("push の直後と pull の直後は、次の判定が skip になる(ムダな送信が起きない)", async () => {
    const { server, remote } = makeServer();
    await store.update(() => ["A"]);
    expect((await sync(remote)).result).toBe("pushed");
    expect((await sync(remote)).result).toBe("skipped");
    expect(server.puts).toBe(1);

    // 別の端末が更新した
    server.text = stringifyBlobRecord({ data: ["B"], updatedAt: (await store.read())!.updatedAt + 1000 });
    expect((await sync(remote)).result).toBe("pulled");
    expect((await store.read())!.data).toEqual(["B"]);
    expect((await sync(remote)).result).toBe("skipped");
    expect(server.puts).toBe(1);
  });

  it("空の一覧も同期される(レコードが無いこととは区別される)", async () => {
    const { server, remote } = makeServer();
    expect(await store.read()).toBeNull();
    expect((await sync(remote)).result).toBe("skipped");

    await store.update(() => ["A"]);
    await sync(remote);
    await store.update(() => []); // 全件削除
    expect((await store.read())!.data).toEqual([]);
    expect((await sync(remote)).result).toBe("pushed");
    expect(parseBlobRecord<string[]>(server.text)).toMatchObject({ data: [] });

    // 別の端末は、空の一覧(新しい)を取り込んで空にする
    const other = new BlobRecordStore<string[]>("test-db", "Other");
    await new LocalStorageService("test-db", "Other").clear();
    await other.update(() => ["stale"]);
    server.text = stringifyBlobRecord({ data: [], updatedAt: Date.now() + 60_000 });
    const result = await runner.run([blobRecordSyncTarget("list", other, remote)]);
    expect(result.results[0].result).toBe("pulled");
    expect((await other.read())!.data).toEqual([]);
  });

  it("リモートの読み取りに失敗したら例外のまま伝え、ローカルを送らない", async () => {
    const failing = textBlobRecordRemote<string[]>({
      read: async () => {
        throw new Error("HTTP 500: boom");
      },
      write: async () => {
        throw new Error("should not be called");
      },
    });
    await store.update(() => ["A"]);
    const result = (await runner.run([blobRecordSyncTarget("list", store, failing)])).results[0];
    expect(result).toMatchObject({ result: "failed", error: "HTTP 500: boom" });
  });
});

describe("BlobRecordStore", () => {
  beforeEach(async () => {
    await new LocalStorageService("test-db", "Blob").clear();
  });

  it("更新日時は編集のたびに必ず進む(端末の時計が戻っても、前より新しい)", async () => {
    const store = new BlobRecordStore<number>("test-db", "Blob");
    const a = await store.update(() => 1);
    const b = await store.update((cur) => (cur ?? 0) + 1);
    const c = await store.update((cur) => (cur ?? 0) + 1);
    expect(b.updatedAt).toBeGreaterThan(a.updatedAt);
    expect(c.updatedAt).toBeGreaterThan(b.updatedAt);
    expect(c.data).toBe(3);
  });

  it("同時に始めた編集は順に実行され、どれも失われない", async () => {
    const store = new BlobRecordStore<string[]>("test-db", "Blob");
    await Promise.all(["a", "b", "c", "d"].map((x) => store.update((cur) => [...(cur ?? []), x])));
    expect((await store.read())!.data).toEqual(["a", "b", "c", "d"]);
  });

  it("replaceIfUnchanged は、更新日時が期待どおりのときだけ書く", async () => {
    const store = new BlobRecordStore<string>("test-db", "Blob");
    expect(await store.replaceIfUnchanged(null, { data: "first", updatedAt: 5 })).toBe(true);
    expect(await store.replaceIfUnchanged(null, { data: "x", updatedAt: 9 })).toBe(false);
    expect(await store.replaceIfUnchanged(4, { data: "x", updatedAt: 9 })).toBe(false);
    expect(await store.replaceIfUnchanged(5, { data: "second", updatedAt: 9 })).toBe(true);
    expect(await store.read()).toEqual({ data: "second", updatedAt: 9 } satisfies SyncSnapshot<string>);
  });
});

describe("parseBlobRecord", () => {
  it("無い・壊れている・古い形式(配列だけ)は、リモートにレコードは無いものとして扱う", () => {
    expect(parseBlobRecord(null)).toBeNull();
    expect(parseBlobRecord("not json")).toBeNull();
    expect(parseBlobRecord("[1,2]")).toBeNull();
    expect(parseBlobRecord(JSON.stringify({ data: [] }))).toBeNull();
    expect(parseBlobRecord(JSON.stringify({ updatedAt: "x", data: [] }))).toBeNull();
  });

  it("書いたとおりに読める", () => {
    expect(parseBlobRecord(stringifyBlobRecord({ data: [1], updatedAt: 7 }))).toEqual({ data: [1], updatedAt: 7 });
  });

  it("purgeOtherRows は、一覧のレコード以外の行(以前の形式)だけを消す", async () => {
    await new LocalStorageService("test-db", "Blob").clear();
    const store = new BlobRecordStore<string[]>("test-db", "Blob");
    await store.update(() => ["A"]);
    const legacy = new LocalStorageService("test-db", "Blob");
    await legacy.save("old-1", { id: "old-1" });
    await legacy.save("old-2", { id: "old-2" });
    await store.purgeOtherRows();
    expect([...(await legacy.getAll()).keys()]).toEqual(["record"]);
    expect((await store.read())!.data).toEqual(["A"]);
  });
});
