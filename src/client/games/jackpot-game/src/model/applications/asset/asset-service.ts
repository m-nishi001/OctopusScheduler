import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import { AssetDto } from "./dto/asset-dto";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../../model/infrastructures/storage-config";
import type { Asset } from "../../domains/asset/asset";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async getAllAssets(): Promise<AssetDto[]> {
    // ローカルストレージから全データを直接取得（リポジトリバイパスでSRPを満たす）
    const localStorage = useLocalStorage(
      StorageConfig.getDbName(),
      StorageConfig.getStoreName("AssetData")
    );
    const assets = (await localStorage.get<Asset[]>("assets")) || [];
    return assets.map((a) => new AssetDto(a));
  }

  async getAssetById(assetId: string): Promise<AssetDto | undefined> {
    const asset = await this.repo.getAssetById(assetId);
    return asset ? new AssetDto(asset) : undefined;
  }

  async addAsset(asset: AssetDto): Promise<AssetDto> {
    const assetEntity = await asset.toAsset();
    const result = await this.repo.addAssets([assetEntity]);
    asset.id = result.successful[0].id;
    return asset;
  }

  async addAssets(
    files: File[] | AssetDto[],
    onProgress?: (index: number, success: boolean) => void
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
    const result = await this.repo.addAssets(assetEntities, onProgress);
    // id をセット
    result.successful.forEach((asset, index) => {
      assetDtos[index].id = asset.id;
    });
    return {
      successful: result.successful
        .map(
          (asset) =>
            assetDtos.find(
              (dto) => dto.name === asset.name && dto.size === asset.size
            )!
        )
        .filter(Boolean),
      failed: result.failed
        .map(
          (asset) =>
            assetDtos.find(
              (dto) => dto.name === asset.name && dto.size === asset.size
            )!
        )
        .filter(Boolean),
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
        const asset = await this.repo.getAssetById?.(id as any);
        name = (asset as any)?.name;
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
