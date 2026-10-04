import { injectable, inject } from "tsyringe";
import { CryptoIdGenerator } from "../common/crypto-id-generator";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { SyncTarget } from "@octopus/sync-engine";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import { Asset } from "./asset-data";
import type {
  DriveData,
  DriveMetadata,
} from "@octopus/infrastructures/compositions";

@injectable()
export class AssetDataRepository {
  private readonly localStorage: LocalStorageService;

  constructor(
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator,
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {
    this.localStorage = new LocalStorageService("jackpot-game", "AssetData");
  }

  async addAssetData(driveData: Asset[]): Promise<Asset[]> {
    const result: Asset[] = [];
    for (const dto of driveData) {
      const id =
        dto.id && dto.id.trim().length > 0 ? dto.id : this.idGenerator.nextId();
      const uploadedAt = dto.uploadedAt ?? new Date().toISOString();
      const lastUpdated = dto.lastUpdated ?? new Date().toISOString();

      let blobToStore: Blob | null = (dto as any).blob ?? null;
      if (blobToStore && typeof (blobToStore as any) === "string") {
        try {
          const resp = await fetch(blobToStore as unknown as string);
          if (resp.ok) blobToStore = await resp.blob();
        } catch (e) {
          blobToStore = null;
        }
      }

      const updated: Asset = new Asset(
        id,
        dto.type,
        dto.name,
        uploadedAt,
        lastUpdated,
        dto.size ?? 0,
        (blobToStore as Blob) || dto.blob
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

  /**
   * バックグラウンド同期エンジン向けに、アセット1件ごとのSyncTargetを列挙する。
   * ローカル/リモートいずれかにのみ存在するIDも含めることで、新規アップロード
   * と新規ダウンロードの両方を1つの差分判定(Last-Write-Wins)で扱う。
   *
   * アセットのidはアップロード時に driveDataId としてそのまま使われ、
   * ダウンロード時もそのidの元で保存するため、同期のたびにidが変わることはない
   * (画面設定(ScreenConfigRepository)が埋め込みで参照するアセットidが
   * 同期後にずれる心配がない)。
   */
  async listSyncTargets(): Promise<SyncTarget<Asset, DriveMetadata>[]> {
    let remoteMetas: DriveMetadata[] = [];
    try {
      // 空文字列ではなく明示的にundefinedを送る。サーバー側が
      // 固定のアセット保存先(storage-paths)を解決するため。
      remoteMetas =
        (await this.jackpotApi.getDriveMetaData(undefined, {
          timeout: 180000,
        })) || [];
    } catch (e) {
      console.error(
        "[AssetDataRepository] Failed to fetch remote asset metadata for sync",
        e
      );
      return [];
    }

    const remoteMap = new Map<string, DriveMetadata>();
    for (const m of remoteMetas) {
      if (m?.driveDataId) remoteMap.set(String(m.driveDataId), m);
    }

    const localRaw = await this.localStorage.getAll<Asset>();
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
        const asset = await this.getAssetDataById(id);
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
        const driveData: DriveData = {
          metadata: {
            driveDataId: id,
            fileId: "",
            parentFolderId: "",
            lastUpdate: clientNow,
            size: asset.size || 0,
          },
          fileName: asset.name,
          fileKind: asset.blob?.type || "application/octet-stream",
          fileDataUrl: dataUrl,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };

        if (remoteMap.has(id)) {
          await this.jackpotApi.updateDriveData(driveData, { timeout: 180000 });
        } else {
          await this.jackpotApi.addDriveData(driveData, { timeout: 180000 });
        }

        await this.localStorage.save(id, { ...asset, lastUpdated: clientNow });
        return { updatedAt: new Date(clientNow).getTime() };
      },
      pull: async (meta) => {
        const driveData = await this.jackpotApi.getDriveData(meta.fileId, {
          timeout: 180000,
        });
        const blob = await this.dataUrlToBlob(
          driveData.fileDataUrl ?? "",
          driveData.fileKind
        );
        const lastUpdated = driveData.metadata?.lastUpdate
          ? String(driveData.metadata.lastUpdate)
          : new Date().toISOString();
        const asset = new Asset(
          id,
          driveData.fileKind || "application/octet-stream",
          driveData.fileName || "",
          driveData.uploadDate ? String(driveData.uploadDate) : new Date().toISOString(),
          lastUpdated,
          driveData.metadata?.size || 0,
          blob
        );
        await this.localStorage.save(id, asset);
        return { updatedAt: new Date(lastUpdated).getTime() };
      },
    };
  }
}
