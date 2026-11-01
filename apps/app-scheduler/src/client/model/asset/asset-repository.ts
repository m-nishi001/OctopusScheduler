import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
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
import { IOctopusSchedulerApiToken, assetRecordHashes } from "../../../server/scheduler-api-contract";
import type { AssetRecordEntry, OctopusSchedulerApi } from "../../../server/scheduler-api-contract";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import type { Asset } from "./asset";

const RECORD_SYNC_KIND = "asset";

/** データURLを Blob にする。 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

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
    private readonly schedulerApi: OctopusSchedulerApi
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

  /**
   * サーバーにある素材の一覧(メタデータ)。`folder` なしは、サーバーの素材の一覧(正)から。
   * `folder` を渡すと、素材置き場直下のそのサブフォルダにあるファイルを一覧する(一覧に載らない、置いただけのファイル)。
   */
  async listRemote(folder?: string): Promise<DriveMetadata[]> {
    if (folder) return (await this.schedulerApi.getDriveMetaData(folder)) || [];
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
      const { dataUrl } = await this.schedulerApi.getAssetBlob({ hash: entry.hash });
      if (!dataUrl) throw new Error(`素材を取得できませんでした: ${id}`);
      blob = dataUrlToBlob(dataUrl);
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
      put: async (hash, blob) => this.schedulerApi.putAssetBlob({ hash, dataUrl: await blobToDataUrl(blob) }),
      get: async (hash) => {
        const { dataUrl } = await this.schedulerApi.getAssetBlob({ hash });
        return dataUrl ? dataUrlToBlob(dataUrl) : null;
      },
    };
  }
}
