import { dataUrlToBlob } from "@octopus/client-common/blob/data-url-to-blob";
import { injectable, inject } from "tsyringe";
import {
  BLOB_HASH_PATTERN,
  BlobRecordStore,
  HashedBlobStore,
  blobRecordSyncTarget,
  hashBlob,
  mapPool,
  textBlobRecordRemote,
  withHashedBlobs,
} from "@octopus/sync-engine";
import type { HashedBlobRemote, PoolOptions, SyncTarget } from "@octopus/sync-engine";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import type { IApiClient } from "@octopus/infrastructures/interfaces";
import { ASSET_BLOB_ROUTE, IOctopusSchedulerApiToken, assetRecordHashes } from "../../../server/scheduler-api-contract";
import type { AssetRecordEntry, OctopusSchedulerApi } from "../../../server/scheduler-api-contract";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import type { Asset } from "./asset";

/** 取込で入れる素材。`id` が一覧にあれば中身の差し替え、無ければ `name` の新しい素材。`hash` は中身のハッシュ。 */
export interface ImportedAsset {
  id: string;
  name: string;
  blob: Blob;
  hash: string;
}

const RECORD_SYNC_KIND = "asset";

/**
 * 素材の保存先。正となるのは、この端末(IndexedDB)の「素材の一覧1件」(`{ data, updatedAt }`)だけ。
 * 素材の中身は内容のハッシュで一覧から参照する、中身の変わらないファイル(別の置き場)。
 * 削除は一覧から外すだけで、サーバーが一覧を書くときに、外れたハッシュのファイルを消す。
 * 一覧が正なので、ファイルだけがあって素材が現れる、ということは起きない。
 * 一覧は以前の素材の行と同じ保存先(`Asset`)に、ファイルは別のデータベースに置く(既存のデータベースにストアを足さない)。素材の `id` は作成時に決まり、同期で変わらない。
 */
@injectable()
export class AssetRepository {
  private readonly list = new BlobRecordStore<AssetRecordEntry[]>("octopus-scheduler", "Asset");
  private readonly blobs = new HashedBlobStore("octopus-scheduler-asset-blobs", "Blobs");
  private legacyCleared: Promise<void> | null = null;

  constructor(
    @inject(IOctopusSchedulerApiToken)
    private readonly schedulerApi: OctopusSchedulerApi,
    @inject(IApiClientToken)
    private readonly apiClient: IApiClient
  ) {}

  /** 以前の形式(素材1件ずつの行)のデータを、(初回だけ)使わずに消す。移行はしない。 */
  private clearLegacy(): Promise<void> {
    this.legacyCleared ??= this.list.purgeOtherRows().catch((e) => console.warn("[AssetRepository] failed to clear legacy rows", e));
    return this.legacyCleared;
  }

  /** 一覧の1件から素材を作る。中身がまだ手元に無ければ null(同期の途中)。 */
  private async toAsset(entry: AssetRecordEntry): Promise<Asset | null> {
    const blob = await this.blobs.get(entry.hash);
    if (!blob) return null;
    return {
      id: entry.id,
      blob,
      name: entry.name,
      uploadedAt: entry.uploadedAt,
      lastUpdated: entry.lastUpdated,
      size: entry.size,
      directoryId: entry.directoryId,
    };
  }

  /** 素材を追加する(同じ id は置き換える)。追加した id を返す。 */
  async addAssets(assets: Asset[]): Promise<string[]> {
    await this.clearLegacy();
    const now = new Date().toISOString();
    const entries: AssetRecordEntry[] = [];
    for (const asset of assets) {
      const hash = await hashBlob(asset.blob);
      await this.blobs.put(hash, asset.blob);
      entries.push({
        id: asset.id || crypto.randomUUID(),
        name: asset.name,
        mime: asset.blob.type || "application/octet-stream",
        hash,
        size: asset.size ?? asset.blob.size ?? 0,
        uploadedAt: asset.uploadedAt || now,
        lastUpdated: now,
        directoryId: asset.directoryId || undefined,
      });
    }
    await this.list.update((current) => {
      const replaced = new Set(entries.map((e) => e.id));
      return [...(current ?? []).filter((e) => !replaced.has(e.id)), ...entries];
    });
    return entries.map((e) => e.id);
  }

  /** 素材の一覧(メタデータだけ。中身は読まない)。 */
  async readEntries(): Promise<AssetRecordEntry[]> {
    await this.clearLegacy();
    return (await this.list.read())?.data ?? [];
  }

  /** 素材の中身をハッシュで読む。端末に無ければ null。 */
  blobOf(hash: string): Promise<Blob | null> {
    return this.blobs.get(hash);
  }

  /**
   * 取込の反映: 中身を端末に並列に入れ、一覧を1回だけ書く。
   * 一覧に同じ `id` があればその素材の中身を差し替え(名前・登録日時は残す)、無ければ新しい素材として追加する。
   * `directories` に `id` があれば、その素材の置き場所(`directoryId`)をそれにする(値が undefined = 置き場直下)。
   * 中身を差し替えずに置き場所だけを変える素材は、`files` に入れず `directories` だけに入れる。
   */
  async applyImport(files: readonly ImportedAsset[], directories: ReadonlyMap<string, string | undefined> = new Map(), pool?: PoolOptions): Promise<void> {
    if (files.length === 0 && directories.size === 0) return;
    await this.clearLegacy();
    await mapPool(files, (f) => this.blobs.put(f.hash, f.blob), pool);
    const now = new Date().toISOString();
    const incoming = new Map(files.map((f) => [f.id, f] as const));
    await this.list.update((current) => {
      const known = new Set((current ?? []).map((e) => e.id));
      const place = (e: AssetRecordEntry): AssetRecordEntry => {
        if (!directories.has(e.id)) return e;
        const directoryId = directories.get(e.id);
        if (directoryId === (e.directoryId || undefined)) return e;
        const moved: AssetRecordEntry = { ...e, directoryId, lastUpdated: now };
        if (!directoryId) delete moved.directoryId;
        return moved;
      };
      const replaced = (current ?? []).map((e): AssetRecordEntry => {
        const f = incoming.get(e.id);
        return place(f ? { ...e, mime: f.blob.type || "application/octet-stream", hash: f.hash, size: f.blob.size, lastUpdated: now } : e);
      });
      const added = files
        .filter((f) => !known.has(f.id))
        .map((f): AssetRecordEntry =>
          place({ id: f.id, name: f.name, mime: f.blob.type || "application/octet-stream", hash: f.hash, size: f.blob.size, uploadedAt: now, lastUpdated: now })
        );
      return [...replaced, ...added];
    });
  }

  async getAssets(): Promise<Asset[]> {
    await this.clearLegacy();
    const record = await this.list.read();
    const assets = await Promise.all((record?.data ?? []).map((e) => this.toAsset(e)));
    return assets.filter((a): a is Asset => a !== null);
  }

  async getAssetById(id: string): Promise<Asset | null> {
    await this.clearLegacy();
    const entry = (await this.list.read())?.data.find((e) => e.id === id);
    return entry ? this.toAsset(entry) : null;
  }

  /** サーバーにある素材の一覧(メタデータ)。サーバーの素材の一覧(正)から作る。 */
  async listRemote(): Promise<DriveMetadata[]> {
    return (await this.remoteEntries()).map((e) => ({
      driveDataId: e.id,
      fileId: "",
      parentFolderId: e.directoryId ?? "",
      lastUpdate: e.lastUpdated,
      size: e.size,
      fileName: e.name,
    }));
  }

  private async remoteEntries(): Promise<AssetRecordEntry[]> {
    const { json } = await this.schedulerApi.getAssetRecord();
    const data = json ? (JSON.parse(json) as { data?: unknown }).data : null;
    return Array.isArray(data) ? (data as AssetRecordEntry[]) : [];
  }

  /**
   * サーバーから素材 1 件の中身を取って返す。
   * `fileId`(フォルダのファイル)があればそのファイルを、無ければ素材の一覧の `id` から、ハッシュのファイルを取る。
   * 一覧の素材の中身は、この端末にハッシュで保存する(一覧そのものは同期が運ぶので、ここでは触らない)。
   * 失敗は例外で返す(成功のふりはしない)。
   */
  async pullRemote(id: string, fileId?: string): Promise<Asset> {
    const now = new Date().toISOString();
    if (fileId) {
      const res = await this.schedulerApi.getDriveData(fileId);
      if (!res?.fileDataUrl) throw new Error(`素材を取得できませんでした: ${id}`);
      const blob = dataUrlToBlob(res.fileDataUrl);
      if (!blob.size) throw new Error(`素材の中身を取得できませんでした: ${id}`);
      return { id, blob, name: res.fileName, uploadedAt: res.uploadDate ? String(res.uploadDate) : now, lastUpdated: now, size: blob.size };
    }
    const entry = (await this.remoteEntries()).find((e) => e.id === id);
    if (!entry) throw new Error(`素材がサーバーにありません: ${id}`);
    let blob = await this.blobs.get(entry.hash);
    if (!blob) {
      blob = await this.apiClient.getBlob(ASSET_BLOB_ROUTE, entry.hash);
      if (!blob) throw new Error(`素材を取得できませんでした: ${id}`);
      if (!blob.size) throw new Error(`素材の中身を取得できませんでした: ${id}`);
      await this.blobs.put(entry.hash, blob);
    }
    return {
      id,
      blob,
      name: entry.name,
      uploadedAt: entry.uploadedAt,
      lastUpdated: entry.lastUpdated,
      size: entry.size,
      directoryId: entry.directoryId,
    };
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.clearLegacy();
    const gone = new Set(ids);
    await this.list.update((current) => (current ?? []).filter((e) => !gone.has(e.id)));
  }

  /**
   * 同期の対象。素材の一覧1件と、それが参照するファイル(上げる → 一覧 → 取ってくる)。
   * 先に一覧の保存先を1つだけ開いておく(同じデータベースの複数のストアを同時に初めて開くと、IndexedDB の版の更新が重なる)。
   */
  async listSyncTargets(): Promise<SyncTarget[]> {
    await this.list.read();
    const record = blobRecordSyncTarget(
      RECORD_SYNC_KIND,
      this.list,
      textBlobRecordRemote<AssetRecordEntry[]>({
        read: async () => (await this.schedulerApi.getAssetRecord()).json,
        write: (json) => this.schedulerApi.saveAssetRecord({ json }),
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
    return {
      exists: async (hashes) => (await this.schedulerApi.existsAssetBlobs({ hashes })).existing,
      put: (hash, blob) => this.apiClient.putBlob(ASSET_BLOB_ROUTE, hash, blob),
      get: (hash) => this.apiClient.getBlob(ASSET_BLOB_ROUTE, hash),
    };
  }
}
