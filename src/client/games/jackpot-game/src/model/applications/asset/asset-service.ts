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
    files: File[] | AssetDto[]
  ): Promise<{ successful: AssetDto[]; failed: AssetDto[] }> {
    let assetDtos: AssetDto[];
    if (files.length > 0 && files[0] instanceof File) {
      assetDtos = (files as File[]).map((file) => new AssetDto(file));
    } else {
      assetDtos = files as AssetDto[];
    }
    const assetEntities = await Promise.all(
      assetDtos.map((dto) => dto.toAsset())
    );
    // addAssets does not have onProgress, so simulate
    const ids = await this.repo.addAssets(assetEntities);
    // Assume all successful for now, since addAssets returns ids
    const successful = assetEntities.map((asset, index) => {
      assetDtos[index].id = ids[index];
      return asset;
    });
    return {
      successful: successful
        .map(
          (asset) =>
            assetDtos.find(
              (dto) => dto.name === asset.name && dto.size === asset.size
            )!
        )
        .filter(Boolean),
      failed: [],
    };
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
    onProgress?: (result: {
      id: string;
      success: boolean;
      name?: string;
      completed: number;
      total: number;
    }) => void
  ): Promise<void> {
    const total = assetIds.length;
    let completed = 0;
    for (const id of assetIds) {
      let name: string | undefined = undefined;
      try {
        const asset = await this.repo.getAssetById(id);
        name = asset?.name;
      } catch (e) {
        /* ignore */
      }
      try {
        await this.deleteAssets([id]);
        completed++;
        onProgress?.({ id, success: true, name, completed, total });
      } catch (e) {
        completed++;
        onProgress?.({ id, success: false, name, completed, total });
      }
    }
  }
}
