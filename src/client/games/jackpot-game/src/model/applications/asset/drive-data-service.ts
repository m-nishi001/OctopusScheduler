import { injectable, inject } from "tsyringe";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import { AssetDataDto, AssetMetadataDto } from "./dto/asset-data-dto";

@injectable()
export class DriveDataService {
  constructor(
    @inject("IDriveDataRepository") private repo: IDriveDataRepository
  ) {}

  async getAllDriveData(): Promise<AssetDataDto[]> {
    return await this.repo.getDriveData();
  }

  async getDriveDataById(id: string): Promise<AssetDataDto | null> {
    return await this.repo.getDriveDataById(id);
  }

  async addDriveData(
    driveDataDtos: AssetDataDto[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<AssetDataDto[]> {
    return await this.repo.addDriveData(driveDataDtos, onProgress);
  }

  // assetDtoToDriveData removed; repository now stores AssetDataDto directly.

  async deleteDriveData(
    ids: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    await this.repo.deleteDriveData(ids);
    ids.forEach((id) => onProgress?.({ id, success: true }));
  }

  async syncDriveData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    return await this.repo.syncDriveData(onProgress);
  }

  public getAllDriveDataMetadata(): Promise<AssetMetadataDto[]> {
    return this.repo.getAllDriveDataMetadata();
  }
  async createDriveDataDtoFromFile(file: File): Promise<AssetDataDto> {
    return new AssetDataDto(
      "",
      file.type,
      file.name,
      new Date(),
      new Date(),
      0,
      undefined
    );
  }

  async createDriveDataDtoWithBlobFromFile(
    file: File
  ): Promise<{ dto: AssetDataDto; blob: Blob }> {
    return {
      dto: new AssetDataDto(
        "",
        file.type,
        file.name,
        new Date(),
        new Date(),
        0,
        file
      ),
      blob: file,
    };
  }
}
