import type { Asset } from "../../domains/assets/entity/asset";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import { injectable, inject } from "tsyringe";

@injectable()
export class AssetService {
  constructor(
    @inject("IAssetRepository") private assetRepository: IAssetRepository
  ) {}

  async addAssets(
    assets: Asset[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]> {
    return await this.assetRepository.addAssets(assets, onProgress);
  }

  async getAssets(): Promise<Asset[]> {
    return await this.assetRepository.getAssets();
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return await this.assetRepository.getAssetById(id);
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.assetRepository.deleteAssets(ids);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    await this.assetRepository.syncAssets(onProgress);
  }

  async getAllAssetMetadata() {
    return await this.assetRepository.getAllAssetMetadata();
  }
}
