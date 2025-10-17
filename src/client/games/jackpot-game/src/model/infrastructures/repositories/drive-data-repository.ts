import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import type {
  DriveData,
  DriveMetadata,
} from "../../../../../../../../src/server/common/src/drive-types";

@injectable()
export class DriveDataRepository implements IDriveDataRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("jackpot-game", "DriveData");
  }

  async addDriveData(
    driveData: DriveData[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const [index, data] of driveData.entries()) {
      const id = crypto.randomUUID();
      const dataWithId: DriveData = {
        ...data,
        metadata: {
          ...data.metadata,
          driveDataId: id,
          lastUpdate: new Date(),
        },
        uploadDate: new Date(),
      };
      await this.localStorage.save(id, dataWithId);
      ids.push(id);
      onProgress?.(index, "完了");
    }
    return ids;
  }

  async getDriveData(): Promise<DriveData[]> {
    const allData = await this.localStorage.getAll<DriveData>();
    return Array.from(allData.values());
  }

  async getDriveDataById(id: string): Promise<DriveData | null> {
    return (await this.localStorage.get<DriveData>(id)) || null;
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

  async getAllDriveDataMetadata(): Promise<DriveMetadata[]> {
    const data = await this.getDriveData();
    return data.map((d) => d.metadata);
  }
}
