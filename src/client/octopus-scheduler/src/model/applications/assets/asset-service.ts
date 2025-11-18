import type { Asset } from "../../domains/assets/entity/asset";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import { injectable, inject } from "tsyringe";
import { IAssetRepositoryToken } from "../../domains/assets/repository/asset-repository";

@injectable()
export class AssetService {
  constructor(
    @inject(IAssetRepositoryToken) private assetRepository: IAssetRepository
  ) {}

  async addAssets(assets: Asset[]): Promise<string[]> {
    return await this.assetRepository.addAssets(assets);
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

  async syncAssets(
    mode: "local" | "drive" = "local",
    onProgress?: (message: string) => void
  ): Promise<void> {
    // mode: 'local' = local->drive, 'drive' = drive->local
    await this.assetRepository.syncAssets(mode, onProgress);
  }
}
