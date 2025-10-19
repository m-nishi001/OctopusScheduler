import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IAssetDataRepository } from "../../domains/drive-data/repository/i-asset-data-repository";
import { Asset, AssetMetadata } from "../../domains/drive-data/asset-data";

@injectable()
export class AssetDataRepository implements IAssetDataRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("jackpot-game", "AssetData");
  }

  async addAssetData(driveData: Asset[]): Promise<Asset[]> {
    const result: Asset[] = [];
    for (const dto of driveData) {
      const id = crypto.randomUUID();
      const updated: Asset = new Asset(
        id,
        dto.type,
        dto.name,
        dto.uploadedAt ?? new Date(),
        dto.lastUpdated ?? new Date(),
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
    onProgress?.("同期完了");
    return { updated: 0, deleted: 0 };
  }

  async getAllAssetDataMetadata(): Promise<AssetMetadata[]> {
    const data = await this.getAssetData();
    return data.map(
      (d) =>
        new AssetMetadata(
          d.id,
          d.type,
          d.name,
          d.uploadedAt,
          d.lastUpdated,
          d.size
        )
    );
  }
}
