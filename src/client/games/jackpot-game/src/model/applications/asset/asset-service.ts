import { injectable, inject } from "tsyringe";
import type {
  IAssetRepository,
  AssetMetadata,
} from "../../domains/asset/repository/i-asset-repository";
import { AssetDto } from "./dto/asset-dto";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async getAllAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.getAssets();
    return assets.map((a) => new AssetDto(a));
  }

  async getAssetById(id: string): Promise<AssetDto | null> {
    const asset = await this.repo.getAssetById(id);
    return asset ? new AssetDto(asset) : null;
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

  async deleteAssets(
    ids: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    await this.repo.deleteAssets(ids);
    ids.forEach((id) => onProgress?.({ id, success: true }));
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    await this.repo.syncAssets(onProgress);
  }

  public getAllAssetMetadata(): Promise<AssetMetadata[]> {
    return this.repo.getAllAssetMetadata();
  }
}
