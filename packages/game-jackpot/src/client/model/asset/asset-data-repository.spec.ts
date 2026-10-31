import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { container } from "tsyringe";
import { FixedConcurrencyPolicy, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { SyncRunner } from "@octopus/sync-engine";
import { AssetDataRepository } from "./asset-data-repository";
import { Asset } from "./asset-data";
import { CryptoIdGenerator } from "../common/crypto-id-generator";
import { ASSET_RECORD_FILE, IJackpotGameApiToken, assetRecordHashes } from "../../../server/jackpot-api-contract";

// この環境の jsdom には crypto.subtle が無いので、中身から決まる値を返す簡易なものに差し替える(同じ内容 → 同じハッシュ)
let uuidCount = 0;
vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_algorithm: string, data: ArrayBuffer) => {
      const out = new Uint8Array(32);
      let h = 2166136261;
      new Uint8Array(data).forEach((b, i) => {
        h = Math.imul(h ^ b, 16777619) >>> 0;
        out[i % 32] ^= h & 255;
      });
      for (let i = 0; i < 32; i++) {
        h = Math.imul(h ^ out[i] ^ i, 16777619) >>> 0;
        out[i] = h & 255;
      }
      return out.buffer;
    },
  },
  randomUUID: () => `uuid-${++uuidCount}`,
});

// jsdom + localforage では保存した Blob を読み戻すと本物の Blob ではなくなり FileReader で読めないので、データURL化だけ差し替える
vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:audio/mpeg;base64,QUJD",
}));

/** サーバーの実装(ハッシュのファイル置き場と一覧の保存)をそのまま使う、メモリ上のサーバー。 */
function makeServer() {
  const store = createHashedBlobStore(StorageModule.Jackpot);
  const deps = { storage: new InMemoryKeyValueStorage() };
  const api = {
    getAssetRecord: async () => store.getRecord(deps, { fileName: ASSET_RECORD_FILE }),
    saveAssetRecord: async (a: { json: string }) =>
      store.saveRecord(deps, { fileName: ASSET_RECORD_FILE, json: a.json }, assetRecordHashes),
    existsAssetBlobs: async (a: { hashes: string[] }) => store.exists(deps, a),
    putAssetBlob: async (a: { hash: string; dataUrl: string }) => store.put(deps, a),
    getAssetBlob: async (a: { hash: string }) => store.get(deps, a),
  };
  const blobCount = async () => (await deps.storage.listByPrefix("jackpot-game/assets/")).length;
  return { api, blobCount };
}

const asset = (id: string, content: string) =>
  new Asset(id, "audio/mpeg", `${id}.mp3`, "2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z", content.length, new Blob([content], { type: "audio/mpeg" }));

async function clearLocal() {
  for (const store of ["AssetList", "AssetBlobs", "AssetData"]) {
    await new LocalStorageService("jackpot-game", store).clear();
  }
}

const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
const sync = async (repo: AssetDataRepository) => {
  const results = (await runner.run(repo.listSyncTargets())).results;
  for (const r of results) expect(r.error).toBeUndefined();
  return results;
};

describe("AssetDataRepository", () => {
  let server: ReturnType<typeof makeServer>;
  let repo: AssetDataRepository;

  const newRepo = () => {
    container.reset();
    container.register(CryptoIdGenerator, { useValue: { nextId: vi.fn(() => "generated-id") } });
    container.register(IJackpotGameApiToken, { useValue: server.api });
    return container.resolve(AssetDataRepository);
  };

  beforeEach(async () => {
    await clearLocal();
    server = makeServer();
    repo = newRepo();
  });

  it("id を渡せばそのまま使い、空なら発行する。同じ id は置き換わる", async () => {
    const [kept] = await repo.addAssetData([asset("my-id-123", "one")]);
    expect(kept.id).toBe("my-id-123");
    const [generated] = await repo.addAssetData([asset("", "two")]);
    expect(generated.id).toBe("generated-id");
    await repo.addAssetData([asset("my-id-123", "changed")]);
    expect((await repo.getAssetData()).map((a) => a.id).sort()).toEqual(["generated-id", "my-id-123"]);
    expect((await repo.getAssetDataById("my-id-123"))!.name).toBe("my-id-123.mp3");
    expect(await repo.getAssetDataById("nope")).toBeNull();
  });

  it("同期でサーバーにファイルと一覧が上がり、削除 → 同期でどちらからも消えて、再同期しても戻らない", async () => {
    await repo.addAssetData([asset("a1", "one"), asset("a2", "two"), asset("a3", "three")]);
    expect((await sync(repo)).map((r) => r.result)).toEqual(["pushed"]);
    expect(await server.blobCount()).toBe(3);

    await repo.deleteAssetData(["a1", "a2", "a3"]); // 同期を待たずに続けて消す
    await sync(repo);
    expect(await repo.getAssetData()).toEqual([]);
    expect(JSON.parse((await server.api.getAssetRecord()).json!).data).toEqual([]);
    expect(await server.blobCount()).toBe(0);
    await sync(repo);
    expect(await repo.getAssetData()).toEqual([]);
  });

  it("別の端末へ同じ id で取り込まれ、そちらで消した結果も元の端末に反映される", async () => {
    await repo.addAssetData([asset("keep", "k"), asset("drop", "d")]);
    await sync(repo);

    await clearLocal();
    const other = newRepo();
    expect((await sync(other)).map((r) => r.result)).toEqual(["pulled"]);
    expect((await other.getAssetData()).map((a) => a.id).sort()).toEqual(["drop", "keep"]);

    await other.deleteAssetData(["drop"]);
    await sync(other);
    expect(await server.blobCount()).toBe(1);

    await clearLocal();
    const third = newRepo();
    await sync(third);
    expect((await third.getAssetData()).map((a) => a.id)).toEqual(["keep"]);
  });

  it("サーバーにファイルだけが残っていても、素材は現れない", async () => {
    await server.api.putAssetBlob({ hash: "e".repeat(32), dataUrl: "data:audio/mpeg;base64,QUJD" });
    await sync(repo);
    expect(await repo.getAssetData()).toEqual([]);
  });

  it("以前の形式のデータは使わずに消す", async () => {
    await new LocalStorageService("jackpot-game", "AssetData").save("old", { id: "old" });
    expect(await repo.getAssetData()).toEqual([]);
    expect((await new LocalStorageService("jackpot-game", "AssetData").getAll()).size).toBe(0);
  });
});
