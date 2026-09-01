import type { Asset } from "../../domains/assets/entity/asset";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import { injectable, inject } from "tsyringe";
import { IAssetRepositoryToken } from "../../domains/assets/repository/asset-repository";

@injectable()
export class AssetService {
  constructor(
    @inject(IAssetRepositoryToken) private assetRepository: IAssetRepository
  ) {}

  async addAssets(assets: Asset[]): Promise<string[]> {
    const ids = await this.assetRepository.addAssets(assets);
    try {
      // notify other interested components that assets changed
      if (typeof window !== "undefined" && (window as any).dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("assets:updated", { detail: { added: ids } })
        );
      }
    } catch (e) {
      // ignore
    }
    return ids;
  }

  async getAssets(): Promise<Asset[]> {
    return await this.assetRepository.getAssets();
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return await this.assetRepository.getAssetById(id);
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.assetRepository.deleteAssets(ids);
    try {
      if (typeof window !== "undefined" && (window as any).dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("assets:updated", { detail: { deleted: ids } })
        );
      }
    } catch (e) {
      // ignore
    }
  }

  async syncAssets(
    mode: "local" | "drive" = "local",
    onProgress?: (message: string) => void
  ): Promise<void> {
    // mode: 'local' = local->drive, 'drive' = drive->local
    await this.assetRepository.syncAssets(mode, onProgress);
  }
}
