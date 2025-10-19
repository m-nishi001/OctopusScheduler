import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import {
  AssetDataDto,
  AssetMetadataDto,
} from "../../applications/asset/dto/asset-data-dto";

@injectable()
export class DriveDataRepository implements IDriveDataRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("jackpot-game", "DriveData");
  }

  async addDriveData(
    driveData: AssetDataDto[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<AssetDataDto[]> {
    const result: AssetDataDto[] = [];
    for (const [index, dto] of driveData.entries()) {
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
      onProgress?.(index, "完了");
    }
    return result;
  }

  async getDriveData(): Promise<AssetDataDto[]> {
    const allData = await this.localStorage.getAll<AssetDataDto>();
    return Array.from(allData.values());
  }

  async getDriveDataById(id: string): Promise<AssetDataDto | null> {
    return (await this.localStorage.get<AssetDataDto>(id)) || null;
  }

  async deleteDriveData(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async syncDriveData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    onProgress?.("同期完了");
    return { updated: 0, deleted: 0 };
  }

  async getAllDriveDataMetadata(): Promise<AssetMetadataDto[]> {
    const data = await this.getDriveData();
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
