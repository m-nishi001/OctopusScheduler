import type {
  DriveData,
  DriveMetadata,
} from "../../../../../../../../server/common/src/drive-types";

export interface IDriveDataRepository {
  addDriveData(
    driveData: DriveData[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]>;
  getDriveData(): Promise<DriveData[]>;
  getDriveDataById(id: string): Promise<DriveData | null>;
  deleteDriveData(ids: string[]): Promise<void>;
  syncDriveData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }>;
  getAllDriveDataMetadata(): Promise<DriveMetadata[]>;
}
