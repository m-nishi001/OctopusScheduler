import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { injectable, inject } from "tsyringe";
import {
  BLOB_HASH_PATTERN,
  BlobRecordStore,
  HashedBlobStore,
  blobRecordSyncTarget,
  hashBlob,
  textBlobRecordRemote,
  withHashedBlobs,
} from "@octopus/sync-engine";
import type { HashedBlobRemote, SyncTarget } from "@octopus/sync-engine";
import { CryptoIdGenerator } from "../common/crypto-id-generator";
import { IJackpotGameApiToken, assetRecordHashes } from "../../../server/jackpot-api-contract";
import type { AssetRecordEntry, JackpotGameApi } from "../../../server/jackpot-api-contract";
import { Asset } from "./asset-data";

const RECORD_SYNC_KIND = "asset";

/** データURLを Blob にする。 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

/**
 * ジャックポットの素材の保存先。正となるのは、この端末(IndexedDB)の「素材の一覧1件」(`{ data, updatedAt }`)だけ。
 * 素材の中身は内容のハッシュで一覧から参照する、中身の変わらないファイル(別の置き場)。
 * 削除は一覧から外すだけで、サーバーが一覧を書くときに、外れたハッシュのファイルを消す。
 * 一覧が正なので、ファイルだけがあって素材が現れる、ということは起きない。
 * 一覧は以前の素材の行と同じ保存先(`AssetData`)に、ファイルは別のデータベースに置く(既存のデータベースにストアを足さない)。
 * 素材の `id` は作成時に決まり、同期で変わらない(景品や画面設定が埋め込みで参照するため)。
 */
@injectable()
export class AssetDataRepository {
  private readonly list = new BlobRecordStore<AssetRecordEntry[]>("jackpot-game", "AssetData");
  private readonly blobs = new HashedBlobStore("jackpot-game-asset-blobs", "Blobs");
  private legacyCleared: Promise<void> | null = null;

  constructor(
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator,
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  /** 以前の形式(素材1件ずつの行)のデータを、(初回だけ)使わずに消す。移行はしない。 */
  private clearLegacy(): Promise<void> {
    this.legacyCleared ??= this.list.purgeOtherRows().catch((e) => console.warn("[AssetDataRepository] failed to clear legacy rows", e));
    return this.legacyCleared;
  }

  /** 一覧の1件から素材を作る。中身がまだ手元に無ければ null(同期の途中)。 */
  private async toAsset(entry: AssetRecordEntry): Promise<Asset | null> {
    const blob = await this.blobs.get(entry.hash);
    if (!blob) return null;
    return new Asset(entry.id, entry.type, entry.name, entry.uploadedAt, entry.lastUpdated, entry.size, blob);
  }

  /** 素材を追加する(同じ id は置き換える。id が空なら発行する)。保存した素材を返す。 */
  async addAssetData(driveData: Asset[]): Promise<Asset[]> {
    await this.clearLegacy();
    const now = new Date().toISOString();
    const saved: Asset[] = [];
    const entries: AssetRecordEntry[] = [];
    for (const dto of driveData) {
      const id = dto.id && dto.id.trim().length > 0 ? dto.id : this.idGenerator.nextId();
      const hash = await hashBlob(dto.blob);
      await this.blobs.put(hash, dto.blob);
      const entry: AssetRecordEntry = {
        id,
        type: dto.type,
        name: dto.name,
        hash,
        size: dto.size ?? dto.blob.size ?? 0,
        uploadedAt: dto.uploadedAt ?? now,
        lastUpdated: dto.lastUpdated ?? now,
      };
      entries.push(entry);
      saved.push(new Asset(id, entry.type, entry.name, entry.uploadedAt, entry.lastUpdated, entry.size, dto.blob));
    }
    await this.list.update((current) => {
      const replaced = new Set(entries.map((e) => e.id));
      return [...(current ?? []).filter((e) => !replaced.has(e.id)), ...entries];
    });
    eventBus.emit("syncDirty");
    return saved;
  }

  async getAssetData(): Promise<Asset[]> {
    await this.clearLegacy();
    const record = await this.list.read();
    const assets = await Promise.all((record?.data ?? []).map((e) => this.toAsset(e)));
    return assets.filter((a): a is Asset => a !== null);
  }

  async getAssetDataById(id: string): Promise<Asset | null> {
    await this.clearLegacy();
    const entry = (await this.list.read())?.data.find((e) => e.id === id);
    return entry ? this.toAsset(entry) : null;
  }

  async deleteAssetData(ids: string[]): Promise<void> {
    await this.clearLegacy();
    const gone = new Set(ids);
    await this.list.update((current) => (current ?? []).filter((e) => !gone.has(e.id)));
    eventBus.emit("syncDirty");
  }

  /**
   * 同期の対象。素材の一覧1件と、それが参照するファイル(上げる → 一覧 → 取ってくる)。
   * 先に一覧の保存先を1つだけ開いておく。同じデータベースの複数のストアを、同時に初めて開くと、
   * IndexedDB の版の更新が重なって、あとから開いたストアが作られないことがある(景品・画面設定の読み込みが返らなくなる)。
   */
  async listSyncTargets(): Promise<SyncTarget[]> {
    await this.list.read();
    const record = blobRecordSyncTarget(
      RECORD_SYNC_KIND,
      this.list,
      textBlobRecordRemote<AssetRecordEntry[]>({
        read: async () => (await this.jackpotApi.getAssetRecord(undefined, { timeout: 180000 })).json,
        write: (json) => this.jackpotApi.saveAssetRecord({ json }, { timeout: 180000 }),
      })
    );
    return [
      withHashedBlobs(record, {
        local: this.blobs,
        remote: this.blobRemote(),
        hashesOf: (data) => assetRecordHashes(data).filter((h) => BLOB_HASH_PATTERN.test(h)),
      }) as SyncTarget,
    ];
  }

  private blobRemote(): HashedBlobRemote {
    const options = { timeout: 180000 };
    return {
      exists: async (hashes) => (await this.jackpotApi.existsAssetBlobs({ hashes }, options)).existing,
      put: async (hash, blob) => this.jackpotApi.putAssetBlob({ hash, dataUrl: await blobToDataUrl(blob) }, options),
      get: async (hash) => {
        const { dataUrl } = await this.jackpotApi.getAssetBlob({ hash }, options);
        return dataUrl ? dataUrlToBlob(dataUrl) : null;
      },
    };
  }
}
