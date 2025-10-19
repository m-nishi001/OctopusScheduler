import type {
  AssetDataDto,
  AssetMetadataDto,
} from "../../../applications/asset/dto/asset-data-dto";

export interface IDriveDataRepository {
  addDriveData(
    driveData: AssetDataDto[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<AssetDataDto[]>;
  getDriveData(): Promise<AssetDataDto[]>;
  getDriveDataById(id: string): Promise<AssetDataDto | null>;
  deleteDriveData(ids: string[]): Promise<void>;
  syncDriveData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }>;
  getAllDriveDataMetadata(): Promise<AssetMetadataDto[]>;
}
