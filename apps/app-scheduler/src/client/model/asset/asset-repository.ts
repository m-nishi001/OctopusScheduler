import { injectable, inject } from "tsyringe";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { SyncTarget } from "@octopus/sync-engine";
import { IOctopusSchedulerApiToken } from "../../../server/scheduler-api-contract";
import type { OctopusSchedulerApi } from "../../../server/scheduler-api-contract";
import type { Asset } from "./asset";
import type { DriveData, DriveMetadata } from "@octopus/infrastructures/compositions";

@injectable()
export class AssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor(
    @inject(IOctopusSchedulerApiToken)
    private readonly schedulerApi: OctopusSchedulerApi
  ) {
    this.localStorage = new LocalStorageService("octopus-scheduler", "Asset");
  }

  private async driveDataToAsset(d: DriveData): Promise<Asset> {
    const asset: Asset = {
      id: d.metadata?.driveDataId || crypto.randomUUID(),
      // initially set an empty Blob; replaced below when fetch succeeds
      blob: new Blob(),
      name: d.fileName,
      uploadedAt: d.uploadDate
        ? String(d.uploadDate)
        : new Date().toISOString(),
      lastUpdated: d.metadata?.lastUpdate
        ? String(d.metadata.lastUpdate)
        : new Date().toISOString(),
      size: d.metadata?.size || 0,
      directoryId: d.metadata?.parentFolderId || undefined,
    };

    try {
      const res = await fetch(d.fileDataUrl);
      asset.blob = await res.blob();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to convert DriveData.fileDataUrl to Blob", e);
    }

    return asset;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  async addAssets(assets: Asset[]): Promise<string[]> {
    const ids: string[] = [];
    for (const asset of assets) {
      const id = asset.id || crypto.randomUUID();
      const assetWithId: Asset = {
        ...asset,
        id,
      };
      await this.localStorage.save(id, assetWithId);
      ids.push(id);
    }
    return ids;
  }

  async getAssets(): Promise<Asset[]> {
    const all = await this.localStorage.getAll<any>();
    const values = Array.from(all.values());
    // parallelize drive-data->asset migration without concurrency cap
    const migrated = await Promise.all(
      values.map(async (v) => {
        if (v && v.fileDataUrl && v.metadata) {
          return await this.driveDataToAsset(v as DriveData);
        }
        return v as Asset;
      })
    );
    const results: Asset[] = migrated as Asset[];
    return results;
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const v = await this.localStorage.get<any>(id);
    if (!v) return null;
    if (v && v.fileDataUrl && v.metadata) {
      return await this.driveDataToAsset(v as DriveData);
    }
    return v as Asset;
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  /**
   * バックグラウンド同期エンジン(SyncRunner)向けに、アセット1件ごとの
   * SyncTargetを列挙する。ローカル/リモートいずれかにのみ存在するIDも
   * 含めることで、新規アップロードと新規ダウンロードの両方を1つの差分判定
   * (Last-Write-Wins)で扱えるようにする。
   */
  async listSyncTargets(): Promise<SyncTarget<Asset, DriveMetadata>[]> {
    let remoteMetas: DriveMetadata[] = [];
    try {
      // 空文字列ではなく明示的にundefinedを送る。サーバー側が
      // ScriptPropertiesで設定済みのアセットフォルダを解決するため。
      remoteMetas = (await this.schedulerApi.getDriveMetaData(undefined)) || [];
    } catch (e) {
      console.error(
        "[AssetRepository] Failed to fetch remote asset metadata for sync",
        e
      );
      return [];
    }

    const remoteMap = new Map<string, DriveMetadata>();
    for (const m of remoteMetas) {
      if (m?.driveDataId) remoteMap.set(String(m.driveDataId), m);
    }

    const localRaw = await this.localStorage.getAll<any>();
    const allIds = new Set<string>([
      ...Array.from(localRaw.keys()),
      ...remoteMap.keys(),
    ]);

    return Array.from(allIds).map((id) => this.buildAssetSyncTarget(id, remoteMap));
  }

  private buildAssetSyncTarget(
    id: string,
    remoteMap: Map<string, DriveMetadata>
  ): SyncTarget<Asset, DriveMetadata> {
    return {
      id,
      kind: "asset",
      getLocal: async () => {
        const asset = await this.getAssetById(id);
        if (!asset) return null;
        return { data: asset, updatedAt: new Date(asset.lastUpdated).getTime() };
      },
      getRemote: async () => {
        const meta = remoteMap.get(id);
        if (!meta) return null;
        return { data: meta, updatedAt: new Date(meta.lastUpdate).getTime() };
      },
      push: async (asset) => {
        const dataUrl = asset.blob ? await this.blobToDataUrl(asset.blob) : "";
        const clientNow = new Date().toISOString();
        const driveData = {
          metadata: {
            driveDataId: id,
            parentFolderId: asset.directoryId || undefined,
            lastUpdate: clientNow,
            size: asset.size || 0,
          },
          fileName: asset.name,
          fileKind: asset.blob?.type || "application/octet-stream",
          fileDataUrl: dataUrl,
          uploadDate: new Date().toISOString(),
          parentFolderId: asset.directoryId || undefined,
        } as any;

        let updatedAtIso = clientNow;
        if (remoteMap.has(id)) {
          await this.schedulerApi.updateDriveData(driveData);
        } else {
          const meta = await this.schedulerApi.addDriveData(driveData);
          updatedAtIso = meta?.lastUpdate ?? clientNow;
        }

        await this.localStorage.save(id, { ...asset, lastUpdated: updatedAtIso });
        return { updatedAt: new Date(updatedAtIso).getTime() };
      },
      pull: async (meta) => {
        const res = await this.schedulerApi.getDriveData(meta.fileId);
        const asset = await this.driveDataToAsset(res);
        await this.localStorage.save(id, asset);
        return { updatedAt: new Date(asset.lastUpdated).getTime() };
      },
    };
  }
}
