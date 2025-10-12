import { injectable, inject } from "tsyringe";
import type {
  IAssetRepository,
  AssetMetadata,
} from "../../domains/asset/repository/i-asset-repository";
import { AssetDto } from "./dto/asset-dto";
import { FileUtils } from "../../infrastructures/utils/file-utils";
import type { Asset } from "../../domains/asset/asset";

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
  ): Promise<AssetDto[]> {
    const assetEntities = await Promise.all(
      assetDtos.map((dto) => dto.toAsset())
    );
    const ids = await this.repo.addAssets(assetEntities, onProgress);
    const updatedAssetDtos = ids.map((id, index) => {
      const updatedAsset: Asset = {
        ...assetEntities[index],
        id,
      };
      return new AssetDto(updatedAsset);
    });
    return updatedAssetDtos;
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

  async registerRef(assetId: string, refSourceId: string): Promise<void> {
    await this.repo.registerRef(assetId, refSourceId);
  }

  async unregisterRef(assetId: string, refSourceId: string): Promise<void> {
    await this.repo.unregisterRef(assetId, refSourceId);
  }

  async createAssetDtoFromFile(file: File): Promise<AssetDto> {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    const asset: Asset = {
      id: "",
      name: file.name,
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size,
      referenceFrom: [],
    };
    return new AssetDto(asset);
  }
}
