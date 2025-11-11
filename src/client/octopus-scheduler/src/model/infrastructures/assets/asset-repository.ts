import { injectable } from "tsyringe";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import type { Asset } from "../../domains/assets/entity/asset";
import type { DriveData } from "@octopus/server-common/drive-types";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
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
    const results: Asset[] = [];
    for (const v of Array.from(all.values())) {
      // migrate older DriveData shape if necessary
      if (v && v.fileDataUrl && v.metadata) {
        results.push(await this.driveDataToAsset(v as DriveData));
      } else {
        results.push(v as Asset);
      }
    }
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

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    // default options
    const concurrency = 6;
    const folderId = "";

    onProgress?.("Starting asset sync (diff-based)");

    // fetch remote metadata
    const metaService = new GasFunctionService("getDriveMetaData");
    let remoteMetas: Array<any> = [];
    try {
      remoteMetas = (await metaService.call(folderId)) || [];
    } catch (e) {
      onProgress?.(`Failed to fetch remote metadata: ${(e as Error).message}`);
      return;
    }

    const remoteMap = new Map<string, any>();
    for (const m of remoteMetas) {
      if (m && m.driveDataId) remoteMap.set(String(m.driveDataId), m);
    }

    // get local assets
    const all = await this.localStorage.getAll<any>();
    const localAssets: Asset[] = [];
    for (const v of Array.from(all.values())) {
      // migrate older DriveData shape if necessary
      if (v && v.fileDataUrl && v.metadata) {
        localAssets.push(await this.driveDataToAsset(v as any));
      } else {
        localAssets.push(v as Asset);
      }
    }

    // prepare upload / update lists based on lastUpdated
    const toUpload: Asset[] = [];
    const toUpdate: Asset[] = [];

    for (const a of localAssets) {
      const id = a.id;
      const remote = remoteMap.get(id);
      const localUpdated = a.lastUpdated
        ? new Date(a.lastUpdated)
        : new Date(0);
      const remoteUpdated =
        remote && remote.lastUpdate ? new Date(remote.lastUpdate) : new Date(0);

      if (!remote) {
        toUpload.push(a);
      } else if (localUpdated > remoteUpdated) {
        toUpdate.push(a);
      }
    }

    onProgress?.(
      `Assets to upload: ${toUpload.length}, to update: ${toUpdate.length}`
    );

    // helper: blob -> dataUrl
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });

    // concurrency runner
    const runInBatches = async <T, R>(
      items: T[],
      handler: (t: T) => Promise<R>
    ) => {
      const results: R[] = [];
      let i = 0;
      const workers: Promise<void>[] = [];
      const next = async () => {
        while (i < items.length) {
          const idx = i++;
          try {
            const r = await handler(items[idx]);
            // @ts-ignore
            results.push(r);
          } catch (e) {
            // ignore per-item errors, report via onProgress
            onProgress?.(`item error: ${(e as Error).message}`);
          }
        }
      };
      for (let w = 0; w < concurrency; w++) workers.push(next());
      await Promise.all(workers);
      return results;
    };

    // uploader
    const addService = new GasFunctionService("addDriveData");
    const updateService = new GasFunctionService("updateDriveData");

    const uploadHandler = async (asset: Asset) => {
      const dataUrl = asset.blob ? await blobToDataUrl(asset.blob) : "";
      const driveData = {
        metadata: {
          driveDataId: asset.id,
          parentFolderId: asset.directoryId || undefined,
          lastUpdate: new Date().toISOString(),
          size: asset.size || 0,
        },
        fileName: asset.name,
        fileKind: asset.blob?.type || "application/octet-stream",
        fileDataUrl: dataUrl,
        uploadDate: new Date().toISOString(),
        parentFolderId: asset.directoryId || "",
      } as any;

      const res = await addService.call(driveData);
      // expect DriveMetadata in response
      if (res) {
        const meta = res as any;
        const newAsset = {
          ...asset,
          lastUpdated: meta.lastUpdate ?? new Date().toISOString(),
        };
        await this.localStorage.save(asset.id, newAsset);
      }
    };

    const updateHandler = async (asset: Asset) => {
      const dataUrl = asset.blob ? await blobToDataUrl(asset.blob) : "";
      const driveData = {
        metadata: {
          driveDataId: asset.id,
          parentFolderId: asset.directoryId || undefined,
          lastUpdate: new Date().toISOString(),
          size: asset.size || 0,
        },
        fileName: asset.name,
        fileKind: asset.blob?.type || "application/octet-stream",
        fileDataUrl: dataUrl,
        uploadDate: new Date().toISOString(),
        parentFolderId: asset.directoryId || "",
      } as any;

      await updateService.call(driveData);
      await this.localStorage.save(asset.id, {
        ...asset,
        lastUpdated: new Date().toISOString(),
      });
    };

    await runInBatches(toUpload, uploadHandler);
    await runInBatches(toUpdate, updateHandler);

    onProgress?.("Asset sync finished");
  }
}
