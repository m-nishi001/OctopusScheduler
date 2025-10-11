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

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    await this.repo.syncAssets(onProgress);
  }

  async deleteAssets(
    assetIds: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    for (const id of assetIds) {
      try {
        await this.repo.deleteAssets([id]);
        onProgress?.({ id, success: true });
      } catch (e) {
        onProgress?.({ id, success: false });
      }
    }
  }
}
