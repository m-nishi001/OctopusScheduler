import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IAssetDataRepository } from "../../domains/drive-data/repository/i-asset-data-repository";
import {
  AssetDataDto,
  AssetMetadataDto,
} from "../../applications/asset/dto/asset-data-dto";

@injectable()
export class AssetDataRepository implements IAssetDataRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("jackpot-game", "AssetData");
  }

  async addAssetData(driveData: AssetDataDto[]): Promise<AssetDataDto[]> {
    const result: AssetDataDto[] = [];
    for (const dto of driveData) {
      const id = crypto.randomUUID();
      const updated: AssetDataDto = new AssetDataDto(
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

  async getAssetData(): Promise<AssetDataDto[]> {
    const allData = await this.localStorage.getAll<AssetDataDto>();
    return Array.from(allData.values());
  }

  async getAssetDataById(id: string): Promise<AssetDataDto | null> {
    return (await this.localStorage.get<AssetDataDto>(id)) || null;
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

  async getAllAssetDataMetadata(): Promise<AssetMetadataDto[]> {
    const data = await this.getAssetData();
    return data.map(
      (d) =>
        new AssetMetadataDto(
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
