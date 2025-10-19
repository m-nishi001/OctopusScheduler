import { injectable, inject } from "tsyringe";
import type { IAssetDataRepository } from "../../domains/drive-data/repository/i-asset-data-repository";
import { Asset, AssetMetadata } from "../../domains/drive-data/asset-data";

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

  public getAllAssetMetadata(): Promise<AssetMetadata[]> {
    return this.repo.getAllAssetDataMetadata();
  }

  async createDriveDataDtoFromFile(file: File): Promise<Asset> {
    return new Asset("", file.type, file.name, new Date(), new Date(), 0, file);
  }
}
