import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { AssetDto } from "./dto/asset-dto";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async fetchAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.fetchAssets();
    if (!Array.isArray(assets) || !assets) return [];
    return assets.map((a) => ({ ...a }));
  }

  async addAsset(asset: AssetDto): Promise<void> {
    await this.repo.addAsset(asset);
  }

  async addAssets(
    files: File[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: File[]; failed: File[] }> {
    return this.repo.addAssets(files, onProgress);
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    await this.repo.updateAsset(asset);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAsset(assetId);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    await this.repo.deleteAssets(assetIds);
  }

  async syncAssetsWithGoogleDrive(
    onProgress?: (message: string) => void
  ): Promise<void> {
    await this.repo.syncAssetsWithGoogleDrive(onProgress);
  }
}
