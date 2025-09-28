import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { AssetDto } from "./dto/asset-dto";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async fetchAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.fetchAssets();
    if (!Array.isArray(assets) || !assets) return [];
    // Entity -> DTO変換（必要ならマッピング処理を追加）
    return assets.map((a) => ({ ...a }));
  }

  /** 新規追加専用 */
  async addAsset(asset: AssetDto): Promise<void> {
    await this.repo.addAsset(asset);
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    await this.repo.updateAsset(asset);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAsset(assetId);
  }
}
