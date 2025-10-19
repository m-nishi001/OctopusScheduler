import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import type {
  DriveData,
  DriveMetadata,
} from "@octopus/server-common/drive-types";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "DriveData"
    );
  }

  async addAssets(
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
          ...(data.metadata || ({} as DriveMetadata)),
          driveDataId: id,
          lastUpdate:
            data.metadata?.lastUpdate || data.uploadDate || new Date(),
          parentFolderId:
            data.metadata?.parentFolderId || data.parentFolderId || "",
          fileId: data.metadata?.fileId || "",
        },
        uploadDate: data.uploadDate || new Date(),
      };
      await this.localStorage.save(id, dataWithId);
      ids.push(id);
      onProgress?.(index, "完了");
    }
    return ids;
  }

  async getAssets(): Promise<DriveData[]> {
    const all = await this.localStorage.getAll<DriveData>();
    return Array.from(all.values());
  }

  async getAssetById(id: string): Promise<DriveData | null> {
    return (await this.localStorage.get<DriveData>(id)) || null;
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    console.info("syncAssets: not implemented (GAS calls removed)");
    onProgress?.("syncAssets: not implemented (GAS calls removed)");
    return Promise.resolve();
  }
}
