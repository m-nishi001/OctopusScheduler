import { AssetRepository } from '../../model/infrastructures/repository/asset-repository';
import type { AssetDto } from './dto/asset-dto';

export class AssetService {
  private readonly repo = new AssetRepository();

  async fetchAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.fetchAssets();
    if (!Array.isArray(assets) || !assets) return [];
    // Entity -> DTO変換（必要ならマッピング処理を追加）
    return assets.map(a => ({ ...a }));
  }

  async saveAsset(asset: AssetDto): Promise<void> {
    await this.repo.saveAsset(asset);
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    await this.repo.updateAsset(asset);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAsset(assetId);
  }
}
