import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import type { IAssetDataRepository } from "../domains/drive-data/repository/i-asset-data-repository";
import { Asset, AssetMetadata } from "../domains/drive-data/asset-data";
import type {
  DriveData,
  DriveMetadata,
} from "../../../../../../server/common/src/drive-types";

@injectable()
export class AssetDataRepository implements IAssetDataRepository {
  private readonly localStorage: LocalStorageService;

  private readonly concurrency = 20;

  constructor() {
    this.localStorage = new LocalStorageService("jackpot-game", "AssetData");
  }

  async addAssetData(driveData: Asset[]): Promise<Asset[]> {
    const result: Asset[] = [];
    for (const dto of driveData) {
      const id = crypto.randomUUID();
      const uploadedAt = dto.uploadedAt ?? new Date().toISOString();
      const lastUpdated = dto.lastUpdated ?? new Date().toISOString();

      const updated: Asset = new Asset(
        id,
        dto.type,
        dto.name,
        uploadedAt,
        lastUpdated,
        dto.size ?? 0,
        dto.blob
      );
      await this.localStorage.save(id, updated);
      result.push(updated);
    }
    return result;
  }

  async getAssetData(): Promise<Asset[]> {
    const allData = await this.localStorage.getAll<Asset>();
    return Array.from(allData.values());
  }

  async getAssetDataById(id: string): Promise<Asset | null> {
    return (await this.localStorage.get<Asset>(id)) || null;
  }

  async deleteAssetData(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async syncAssetData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    onProgress?.("Start asset sync (jackpot-game)");

    const remoteMetas = await this.fetchRemoteMetas(onProgress);
    if (!remoteMetas) return { updated: 0, deleted: 0 };

    const all = await this.localStorage.getAll<Asset>();
    const localAssets: Asset[] = Array.from(all.values());

    const remoteMap = new Map<string, DriveMetadata>();
    for (const m of remoteMetas)
      if (m && m.driveDataId) remoteMap.set(String(m.driveDataId), m);

    const toUpload = localAssets.filter((a) => {
      const remote = remoteMap.get(a.id);
      const localUpdated = a.lastUpdated
        ? new Date(a.lastUpdated)
        : new Date(0);
      const remoteUpdated =
        remote && remote.lastUpdate
          ? new Date(String(remote.lastUpdate))
          : new Date(0);
      return !remote || localUpdated > remoteUpdated;
    });

    onProgress?.(`Assets to upload: ${toUpload.length}`);

    const uploaded = await this.uploadAssets(toUpload, onProgress);

    onProgress?.("Asset sync finished");
    return { updated: uploaded, deleted: 0 };
  }

  private async fetchRemoteMetas(
    onProgress?: (message: string) => void
  ): Promise<DriveMetadata[] | null> {
    const metaService = new GasFunctionService("getDriveMetaData", {
      timeout: 180000,
    });
    try {
      const metas = (await metaService.call<DriveMetadata[]>()) || [];
      return metas as DriveMetadata[];
    } catch (e) {
      onProgress?.(`Failed to fetch remote metadata: ${(e as Error).message}`);
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(
    dataUrl: string,
    mime: string | undefined
  ): Promise<Blob> {
    if (!dataUrl) return new Blob();

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (blob.type) return blob;
      return new Blob([await blob.arrayBuffer()], {
        type: mime || "application/octet-stream",
      });
    } catch (e) {
      return new Blob();
    }
  }

  private async runInBatches<T, R>(
    items: T[],
    worker: (item: T) => Promise<R | null>,
    concurrency = this.concurrency
  ): Promise<Array<R | null>> {
    const results: Array<R | null> = new Array(items.length).fill(null);
    let idx = 0;
    const runners: Promise<void>[] = [];
    const next = async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) return;
        try {
          const r = await worker(items[i]);
          results[i] = r;
        } catch (e) {
          results[i] = null;
        }
      }
    };
    for (let i = 0; i < Math.min(concurrency, items.length); i++)
      runners.push(next());
    await Promise.all(runners);
    return results;
  }

  private async uploadAssets(
    assets: Asset[],
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<number> {
    const addService = new GasFunctionService("addDriveData", {
      timeout: 180000,
    });
    let uploaded = 0;

    const worker = async (asset: Asset) => {
      try {
        const dataUrl = asset.blob ? await this.blobToDataUrl(asset.blob) : "";
        const driveData: DriveData = {
          metadata: {
            driveDataId: asset.id,
            fileId: "",
            parentFolderId: "",
            lastUpdate: asset.lastUpdated || new Date().toISOString(),
            size: asset.size || 0,
          },
          fileName: asset.name,
          fileKind: asset.blob?.type || "application/octet-stream",
          fileDataUrl: dataUrl,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };

        const res = await addService.call(driveData);
        if (res) {
          await this.localStorage.save(asset.id, {
            ...asset,
            lastUpdated: new Date().toISOString(),
          });
          uploaded++;
          onProgress?.(`Uploaded: ${uploaded}/${assets.length}`, {
            current: uploaded,
            total: assets.length,
          });
        }
      } catch (e) {
        onProgress?.(`upload error: ${(e as Error).message}`);
      }
      return null;
    };

    await this.runInBatches(assets, worker, this.concurrency);
    return uploaded;
  }

  private async fetchDriveAssets(
    remoteMetas: DriveMetadata[],
    onProgress?: (message: string) => void
  ): Promise<Asset[]> {
    const getService = new GasFunctionService("getDriveData", {
      timeout: 180000,
    });
    const assets: Asset[] = [];
    let fetched = 0;

    const worker = async (m: DriveMetadata) => {
      try {
        const driveData = await getService.call<DriveData>(m.fileId);
        if (!driveData) return null;

        const blob = await this.dataUrlToBlob(
          driveData.fileDataUrl ?? "",
          driveData.fileKind
        );

        const asset = new Asset(
          driveData.metadata?.driveDataId || crypto.randomUUID(),
          driveData.fileKind || "application/octet-stream",
          driveData.fileName || "",
          driveData.uploadDate
            ? typeof driveData.uploadDate === "string"
              ? driveData.uploadDate
              : new Date(String(driveData.uploadDate)).toISOString()
            : new Date().toISOString(),
          driveData.metadata?.lastUpdate
            ? typeof driveData.metadata.lastUpdate === "string"
              ? driveData.metadata.lastUpdate
              : new Date(String(driveData.metadata.lastUpdate)).toISOString()
            : new Date().toISOString(),
          driveData.metadata?.size || 0,
          blob
        );

        fetched++;
        onProgress?.(`Fetched ${fetched}/${remoteMetas.length}`);
        return asset;
      } catch (e) {
        onProgress?.(`error fetching drive data: ${(e as Error).message}`);
        return null;
      }
    };

    const results = await this.runInBatches(
      remoteMetas,
      worker,
      this.concurrency
    );
    for (const r of results) if (r) assets.push(r as Asset);
    return assets;
  }

  async replaceLocalWithDrive(
    onProgress?: (message: string) => void
  ): Promise<{ replaced: number }> {
    onProgress?.("Start replacing local assets from Google Drive");

    const remoteMetas = await this.fetchRemoteMetas(onProgress);
    if (!remoteMetas) return { replaced: 0 };

    const allLocal = await this.localStorage.getAll<Asset>();
    const localMap = new Map<string, Asset>();
    for (const [k, v] of allLocal) localMap.set(String(k), v as Asset);

    const neededMetas = remoteMetas.filter((m) => {
      const id = String(m.driveDataId);
      const local = localMap.get(id);
      if (!local) return true; // missing locally
      const localUpdated = local.lastUpdated
        ? new Date(local.lastUpdated)
        : new Date(0);
      const remoteUpdated = m.lastUpdate
        ? new Date(String(m.lastUpdate))
        : new Date(0);
      return remoteUpdated > localUpdated;
    });

    onProgress?.(
      `Need to fetch ${neededMetas.length}/${remoteMetas.length} remote files`
    );

    const assets = await this.fetchDriveAssets(neededMetas, onProgress);

    try {
      await this.localStorage.clear();
      for (const a of assets) {
        await this.localStorage.save(a.id, a);
      }
    } catch (e) {
      onProgress?.(`Failed to save local assets: ${(e as Error).message}`);
      return { replaced: 0 };
    }

    onProgress?.(`Replaced local assets: ${assets.length}`);
    return { replaced: assets.length };
  }

  async getAllAssetDataMetadata(): Promise<AssetMetadata[]> {
    const data = await this.getAssetData();
    return data.map(
      (d) =>
        new AssetMetadata(
          d.id,
          d.type,
          d.name,
          // ensure returned metadata timestamps are ISO strings
          typeof d.uploadedAt === "string"
            ? d.uploadedAt
            : new Date(String(d.uploadedAt)).toISOString(),
          typeof d.lastUpdated === "string"
            ? d.lastUpdated
            : new Date(String(d.lastUpdated)).toISOString(),
          d.size
        )
    );
  }
}
