import "reflect-metadata";
import { webcrypto } from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FixedConcurrencyPolicy, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { SyncRunner } from "@octopus/sync-engine";
import { AssetRepository } from "./asset-repository";
import type { Asset } from "./asset";
import { ASSET_RECORD_FILE, assetRecordHashes } from "../../../server/scheduler-api-contract";

// この環境の jsdom には crypto.subtle が無いので、Node のものを使う
vi.stubGlobal("crypto", webcrypto);

// jsdom + localforage では保存した Blob を読み戻すと本物の Blob ではなくなり FileReader で読めないので、データURL化だけ差し替える
vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:image/png;base64,QUJD",
}));

/** サーバーの実装(ハッシュのファイル置き場と一覧の保存)をそのまま使う、メモリ上のサーバー。 */
function makeServer() {
  const store = createHashedBlobStore(StorageModule.Scheduler);
  const deps = { storage: new InMemoryKeyValueStorage() };
  const api = {
    getAssetRecord: async () => store.getRecord(deps, { fileName: ASSET_RECORD_FILE }),
    saveAssetRecord: async (a: { json: string }) =>
      store.saveRecord(deps, { fileName: ASSET_RECORD_FILE, json: a.json }, assetRecordHashes),
    existsAssetBlobs: async (a: { hashes: string[] }) => store.exists(deps, a),
    putAssetBlob: async (a: { hash: string; dataUrl: string }) => store.put(deps, a),
    getAssetBlob: async (a: { hash: string }) => store.get(deps, a),
  };
  const blobCount = async () => (await deps.storage.listByPrefix("octopus-scheduler/assets/")).length;
  return { api, blobCount };
}

const asset = (id: string, content: string): Asset => ({
  id,
  blob: new Blob([content], { type: "image/png" }),
  name: `${id}.png`,
  uploadedAt: "2024-01-01T00:00:00.000Z",
  lastUpdated: "2024-01-01T00:00:00.000Z",
  size: content.length,
});

async function clearLocal() {
  for (const store of ["AssetList", "AssetBlobs", "Asset"]) {
    await new LocalStorageService("octopus-scheduler", store).clear();
  }
}

const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
const sync = async (repo: AssetRepository) => {
  const results = (await runner.run(repo.listSyncTargets())).results;
  for (const r of results) expect(r.error).toBeUndefined();
  return results;
};

describe("AssetRepository", () => {
  let server: ReturnType<typeof makeServer>;
  let repo: AssetRepository;

  beforeEach(async () => {
    await clearLocal();
    server = makeServer();
    repo = new AssetRepository(server.api as any);
  });

  it("追加した素材を id で読み戻せ、同じ id は置き換わる", async () => {
    expect(await repo.addAssets([asset("a1", "one"), asset("a2", "two")])).toEqual(["a1", "a2"]);
    await repo.addAssets([asset("a1", "changed")]);
    expect((await repo.getAssets()).map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect((await repo.getAssetById("a1"))!.name).toBe("a1.png");
    expect(await repo.getAssetById("nope")).toBeNull();
  });

  it("同期でサーバーにファイルと一覧が上がり、削除 → 同期でどちらからも消えて、再同期しても戻らない", async () => {
    await repo.addAssets([asset("a1", "one"), asset("a2", "two"), asset("a3", "three")]);
    expect((await sync(repo)).map((r) => r.result)).toEqual(["pushed"]);
    expect(await server.blobCount()).toBe(3);

    await repo.deleteAssets(["a1", "a2", "a3"]); // 同期を待たずに続けて消す
    await sync(repo);
    expect(await repo.getAssets()).toEqual([]);
    expect(JSON.parse((await server.api.getAssetRecord()).json!).data).toEqual([]);
    expect(await server.blobCount()).toBe(0);
    await sync(repo);
    expect(await repo.getAssets()).toEqual([]);
  });

  it("別の端末へ同じ id で取り込まれ、そちらで消した結果も元の端末に反映される", async () => {
    await repo.addAssets([asset("keep", "k"), asset("drop", "d")]);
    await sync(repo);

    await clearLocal();
    const other = new AssetRepository(server.api as any);
    expect((await sync(other)).map((r) => r.result)).toEqual(["pulled"]);
    expect((await other.getAssets()).map((a) => a.id).sort()).toEqual(["drop", "keep"]);

    await other.deleteAssets(["drop"]);
    await sync(other);
    expect(await server.blobCount()).toBe(1);

    await clearLocal();
    const third = new AssetRepository(server.api as any);
    await sync(third);
    expect((await third.getAssets()).map((a) => a.id)).toEqual(["keep"]);
  });

  it("サーバーにファイルだけが残っていても、素材は現れない", async () => {
    await server.api.putAssetBlob({ hash: "e".repeat(32), dataUrl: "data:image/png;base64,QUJD" });
    await sync(repo);
    expect(await repo.getAssets()).toEqual([]);
  });

  it("以前の形式のデータは使わずに消す", async () => {
    await new LocalStorageService("octopus-scheduler", "Asset").save("old", { id: "old" });
    expect(await repo.getAssets()).toEqual([]);
    expect((await new LocalStorageService("octopus-scheduler", "Asset").getAll()).size).toBe(0);
  });
});
