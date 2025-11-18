import { injectable, container } from "tsyringe";
import { AssetDataRepository } from "../../infrastructures/asset-data-repository";
import type { IAssetDataRepository } from "../../domains/drive-data/repository/i-asset-data-repository";
import { Asset } from "../../domains/drive-data/asset-data";

@injectable()
export class AssetDataService {
  private repo: IAssetDataRepository;

  constructor() {
    // Resolve repository by class token. Registrations are expected to be
    // performed during app bootstrap.
    this.repo = container.resolve(AssetDataRepository) as IAssetDataRepository;
  }

  async getAllAssetData(): Promise<Asset[]> {
    return await this.repo.getAssetData();
  }

  async getAssetDataById(id: string): Promise<Asset | null> {
    return await this.repo.getAssetDataById(id);
  }

  async addAssetData(assetData: Asset[]): Promise<Asset[]> {
    return await this.repo.addAssetData(assetData);
  }

  async deleteAssetData(
    ids: string[],
    onProgress?: (result: { id: string; success: boolean }) => void
  ): Promise<void> {
    await this.repo.deleteAssetData(ids);
    ids.forEach((id) => onProgress?.({ id, success: true }));
  }

  async syncAssetData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    return await this.repo.syncAssetData(onProgress);
  }

  async replaceLocalWithDrive(
    onProgress?: (message: string) => void
  ): Promise<{ replaced: number; idMap?: { [oldId: string]: string } }> {
    return await this.repo.replaceLocalWithDrive(onProgress);
  }

  async createDriveDataDtoFromFile(file: File): Promise<Asset> {
    const now = new Date().toISOString();
    const normalizedName = (file.name || "").normalize
      ? (file.name || "").normalize("NFC")
      : file.name || "";
    return new Asset(
      "",
      file.type,
      normalizedName,
      now,
      now,
      file.size ?? 0,
      file
    );
  }
}
