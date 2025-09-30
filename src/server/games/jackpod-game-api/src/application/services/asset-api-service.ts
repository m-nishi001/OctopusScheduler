import { injectable, inject } from "tsyringe";
import { GasService } from "./gas-service";
import { AssetDto } from "../dtos/asset.dto";
import { AssetRepositoryImplStatic } from "../../infrastructure/repositories/asset-repository";
import { IAssetRepository } from "../../domain/repositories/asset-repository";
import { toAssetEntity, toAssetDto } from "../dtos/asset.mapper";

@injectable()
export class AssetApiService implements GasService {
  readonly serviceName = "AssetService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IAssetRepository") private repository: IAssetRepository
  ) {
    this.functions = {
      uploadAsset: this.uploadAsset.bind(this),
      deleteAsset: this.deleteAsset.bind(this),
      getAssetById: this.getAssetById.bind(this),
      listAssets: this.listAssets.bind(this),
      getAssets: this.getAssets.bind(this),
      uploadDomainAsset: this.uploadDomainAsset.bind(this),
      getDomainAsset: this.getDomainAsset.bind(this),
      addAsset: this.addAsset.bind(this),
    };
  }

  uploadAsset(args: { fileName: string; mimeType: string; dataUrl: string }): {
    asset: AssetDto;
  } {
    const blob = AssetRepositoryImplStatic.convertToBlobFromDataUrl(
      args.dataUrl,
      args.fileName,
      args.mimeType
    );
    const assetId = AssetRepositoryImplStatic.uploadAsset(
      args.fileName,
      args.mimeType,
      blob
    );
    const file = AssetRepositoryImplStatic.getAssetById(assetId);

    const type = this.getAssetType(args.mimeType);

    const asset: AssetDto = file
      ? {
          id: file.getId(),
          type,
          url: "",
          name: file.getName(),
          uploadedAt: "",
          size: file.getSize(),
          meta: {},
        }
      : {
          id: assetId,
          type,
          url: "",
          name: args.fileName,
          uploadedAt: "",
          size: 0,
          meta: {},
        };
    return { asset };
  }

  deleteAsset(args: { assetId: string }): { success: boolean } {
    AssetRepositoryImplStatic.deleteAsset(args.assetId);
    return { success: true };
  }

  getAssetById(args: { assetId: string }): GoogleAppsScript.Drive.File | null {
    return AssetRepositoryImplStatic.getAssetById(args.assetId);
  }

  listAssets(): GoogleAppsScript.Drive.File[] {
    return AssetRepositoryImplStatic.listAssets();
  }

  getAssets(): { assets: AssetDto[] } {
    const assets = this.repository.findAll();
    return { assets: assets.map(toAssetDto) };
  }

  uploadDomainAsset(assetDto: AssetDto): string {
    const assetEntity = toAssetEntity(assetDto);
    return this.repository.uploadAsset(assetEntity);
  }

  getDomainAsset(id: string): AssetDto | null {
    const assetEntity = this.repository.getAsset(id);
    return assetEntity ? toAssetDto(assetEntity) : null;
  }

  addAsset(args: AssetDto): { asset: AssetDto } {
    const assetDto = args;
    if (!assetDto.url.startsWith("data:")) {
      throw new Error("Invalid data URL");
    }
    const blob = AssetRepositoryImplStatic.convertToBlobFromDataUrl(
      assetDto.url,
      assetDto.name,
      assetDto.type === "image"
        ? "image/png"
        : assetDto.type === "video"
          ? "video/mp4"
          : assetDto.type === "audio"
            ? "audio/mp3"
            : "text/plain"
    );
    const assetId = AssetRepositoryImplStatic.uploadAsset(
      assetDto.name,
      assetDto.type === "image"
        ? "image/png"
        : assetDto.type === "video"
          ? "video/mp4"
          : assetDto.type === "audio"
            ? "audio/mp3"
            : "text/plain",
      blob
    );
    const file = AssetRepositoryImplStatic.getAssetById(assetId);
    const type = this.getAssetType(
      file
        ? file.getMimeType()
        : assetDto.type === "image"
          ? "image/png"
          : assetDto.type === "video"
            ? "video/mp4"
            : assetDto.type === "audio"
              ? "audio/mp3"
              : "text/plain"
    );
    const uploadedAsset: AssetDto = file
      ? {
          id: file.getId(),
          type,
          url: file.getDownloadUrl(),
          name: file.getName(),
          uploadedAt: file.getDateCreated().toISOString(),
          size: file.getSize(),
          meta: {},
        }
      : {
          id: assetId,
          type,
          url: "",
          name: assetDto.name,
          uploadedAt: new Date().toISOString(),
          size: assetDto.size,
          meta: {},
        };
    return { asset: uploadedAsset };
  }

  private getAssetType(mimeType: string): "image" | "video" | "audio" | "text" {
    if (mimeType.startsWith("image/")) {
      return "image";
    } else if (mimeType.startsWith("video/")) {
      return "video";
    } else if (mimeType.startsWith("audio/")) {
      return "audio";
    } else {
      return "text";
    }
  }
}
