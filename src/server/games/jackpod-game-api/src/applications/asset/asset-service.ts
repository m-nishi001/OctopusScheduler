import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { AssetDto, AssetMetadataDto } from "./asset-dto";
import { IAssetRepository } from "../../domain/asset/asset-repository";

@injectable()
export class AssetService implements GasService {
  readonly serviceName = "AssetService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IAssetRepository") private repository: IAssetRepository
  ) {
    this.functions = {
      deleteAsset: this.deleteAsset.bind(this),
      getAssetById: this.getAssetById.bind(this),
      getAssetMetadata: this.getAssetMetadata.bind(this),
      addAsset: this.addAsset.bind(this),
    };
  }

  async deleteAsset(args: { assetId: string }): Promise<{ success: boolean }> {
    await this.repository.deleteAsset(args.assetId);
    return { success: true };
  }

  async getAssetById(args: {
    assetId: string;
  }): Promise<{ asset: AssetDto | null }> {
    const asset = await this.repository.getAsset(args.assetId);
    return { asset: asset ? new AssetDto(asset) : null };
  }

  async getAssetMetadata(): Promise<{ assets: AssetMetadataDto[] }> {
    const assets = await this.repository.findAllMetadata();
    return { assets };
  }

  async addAsset(args: AssetDto): Promise<{ asset: AssetDto }> {
    const assetEntity = AssetDto.toAsset(args);
    const assetId = await this.repository.uploadAsset(assetEntity);
    const uploadedAsset = await this.repository.getAsset(assetId);
    return { asset: uploadedAsset ? new AssetDto(uploadedAsset) : args };
  }
}
