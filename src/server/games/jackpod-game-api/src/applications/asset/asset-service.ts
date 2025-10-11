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
      getAsset: this.getAsset.bind(this),
      getAssetMetaData: this.getAssetMetaData.bind(this),
      getAssets: this.getAssets.bind(this),
      addAsset: this.addAsset.bind(this),
    };
  }

  deleteAsset(args: { assetId: string }): { success: boolean } {
    this.repository.deleteAsset(args.assetId);
    return { success: true };
  }

  getAsset(args: { assetId: string }): { asset: AssetDto | null } {
    const asset = this.repository.getAsset(args.assetId);
    return { asset: asset ? new AssetDto(asset) : null };
  }

  getAssetMetaData(args: { assetId: string }): {
    metadata: AssetMetadataDto | null;
  } {
    const metadata = this.repository.getAssetMetadata(args.assetId);
    return { metadata };
  }

  getAssets(): { assets: AssetDto[] } {
    const assets = this.repository.findAll();
    return { assets: assets.map((a) => new AssetDto(a)) };
  }

  addAsset(args: AssetDto): { asset: AssetDto } {
    const assetEntity = AssetDto.toAsset(args);
    const assetId = this.repository.uploadAsset(assetEntity);
    const uploadedAsset = this.repository.getAsset(assetId);
    return { asset: uploadedAsset ? new AssetDto(uploadedAsset) : args };
  }
}
