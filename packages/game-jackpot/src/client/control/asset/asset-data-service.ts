import { injectable, container } from "tsyringe";
import type { SyncTarget } from "@octopus/sync-engine";
import { AssetDataRepository } from "../../model/asset/asset-data-repository";
import { Asset } from "../../model/asset/asset-data";

@injectable()
export class AssetDataService {
  private repo: AssetDataRepository;

  constructor() {
    // Resolve repository by class token. Registrations are expected to be
    // performed during app bootstrap.
    this.repo = container.resolve(AssetDataRepository);
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

  async listSyncTargets(): Promise<SyncTarget[]> {
    return await this.repo.listSyncTargets();
  }

  async createDriveDataDtoFromFile(file: File): Promise<Asset> {
    const now = new Date().toISOString();
    let normalizedName = file.name || "";
    try {
      normalizedName = normalizedName.normalize("NFC");
    } catch {
      // normalize may not be available in some environments; fallback to raw name
      normalizedName = file.name || "";
    }
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
