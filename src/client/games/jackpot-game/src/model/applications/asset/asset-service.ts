import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import { AssetDto } from "./dto/asset-dto";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async getAllAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.getAssets();
    return assets.map((a) => new AssetDto(a));
  }

  async getAssetById(assetId: string): Promise<AssetDto | undefined> {
    const asset = await this.repo.getAssetById(assetId);
    return asset ? new AssetDto(asset) : undefined;
  }

  async addAsset(asset: AssetDto): Promise<AssetDto> {
    const assetEntity = await asset.toAsset();
    const ids = await this.repo.addAssets([assetEntity]);
    asset.id = ids[0];
    return asset;
  }

  async addAssets(
    assetDtos: AssetDto[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<void> {
    const assetEntities = await Promise.all(
      assetDtos.map((dto) => dto.toAsset())
    );
    const ids = await this.repo.addAssets(assetEntities, onProgress);
    ids.forEach((id, index) => {
      assetDtos[index].id = id;
    });
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    const assetEntity = await asset.toAsset();
    await this.repo.addAssets([assetEntity]);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAssets([assetId]);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    await this.repo.deleteAssets(assetIds);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    await this.repo.syncAssets(onProgress);
  }

  async deleteAssetsWithProgress(
    assetIds: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    for (const id of assetIds) {
      try {
        await this.deleteAssets([id]);
        onProgress?.({ id, success: true });
      } catch (e) {
        onProgress?.({ id, success: false });
      }
    }
  }
}
