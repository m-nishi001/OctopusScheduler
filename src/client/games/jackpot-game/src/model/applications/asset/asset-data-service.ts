import { injectable, inject } from "tsyringe";
import type { IAssetDataRepository } from "../../domains/drive-data/repository/i-asset-data-repository";
import { Asset } from "../../domains/drive-data/asset-data";

@injectable()
export class AssetDataService {
  constructor(
    @inject("IAssetDataRepository") private repo: IAssetDataRepository
  ) {}

  async getAllAssetData(): Promise<Asset[]> {
    return await this.repo.getAssetData();
  }

  async getAssetDataById(id: string): Promise<Asset | null> {
    return await this.repo.getAssetDataById(id);
  }

  async addAssetData(assetData: Asset[]): Promise<Asset[]> {
    return await this.repo.addAssetData(assetData);
  }

  async deleteAssetData(
    ids: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    await this.repo.deleteAssetData(ids);
    ids.forEach((id) => onProgress?.({ id, success: true }));
  }

  async syncAssetData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    return await this.repo.syncAssetData(onProgress);
  }

  async replaceLocalWithDrive(
    onProgress?: (message: string) => void
  ): Promise<{ replaced: number }> {
    return await this.repo.replaceLocalWithDrive(onProgress);
  }

  async createDriveDataDtoFromFile(file: File): Promise<Asset> {
    const now = new Date().toISOString();
    return new Asset("", file.type, file.name, now, now, 0, file);
  }
}
