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

  deleteAsset(args: { assetId: string }): { success: boolean } {
    this.repository.deleteAsset(args.assetId);
    return { success: true };
  }

  getAssetById(args: { assetId: string }): { asset: AssetDto | null } {
    const asset = this.repository.getAsset(args.assetId);
    return { asset: asset ? new AssetDto(asset) : null };
  }

  getAssetMetadata(): { assets: AssetMetadataDto[] } {
    const assets = this.repository.findAllMetadata();
    return { assets };
  }

  addAsset(args: AssetDto): { asset: AssetDto } {
    const assetEntity = AssetDto.toAsset(args);
    const assetId = this.repository.uploadAsset(assetEntity);
    const uploadedAsset = this.repository.getAsset(assetId);
    return { asset: uploadedAsset ? new AssetDto(uploadedAsset) : args };
  }
}
