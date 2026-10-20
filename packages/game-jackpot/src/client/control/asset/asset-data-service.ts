import { injectable, container } from "tsyringe";
import type { SyncTarget } from "@octopus/sync-engine";
import { AssetDataRepository } from "../../model/asset/asset-data-repository";
import { Asset } from "../../model/asset/asset-data";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";

/** ジャックポットの素材(画像・音声)の取得・登録と、同期の対象の一覧。アップロードしたファイルから、保存前の素材(id つき)も作る。 */
@injectable()
export class AssetDataService {
  private repo: AssetDataRepository;
  private readonly ids = container.resolve(CryptoIdGenerator);

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

  /**
   * アップロードするファイルから、保存前のアセットを作る。**id はここで発行する**。
   * 呼び出し側は、保存を待たずに、この id を設定(BGM・画像・効果音の参照)に書ける。
   * (id が空のまま渡すと、保存時に別の id が付き、設定の参照先が「空の id」のまま残る。)
   */
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
      this.ids.nextId(),
      file.type,
      normalizedName,
      now,
      now,
      file.size ?? 0,
      file
    );
  }
}
