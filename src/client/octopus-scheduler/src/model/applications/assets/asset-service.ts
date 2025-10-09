import type { Asset } from "src/model/domains/assets/entity/assset";
import type { IAssetRepository } from "src/model/domains/assets/repository/asset-repository";
import { injectable, inject } from "tsyringe";

@injectable()
export class AssetService {
  constructor(
    @inject("IAssetRepository") private assetRepository: IAssetRepository
  ) {}

  async addAsset(asset: Asset): Promise<void> {
    await this.assetRepository.add(asset);
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return await this.assetRepository.findById(id);
  }

  async getAllAssets(): Promise<Asset[]> {
    return await this.assetRepository.findAll();
  }

  async deleteAsset(id: string): Promise<void> {
    await this.assetRepository.delete(id);
  }

  async syncAssets(): Promise<void> {
    await this.assetRepository.sync();
  }
}
