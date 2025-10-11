import type { Asset } from "../../../domains/asset/asset";
import { FileUtils } from "../../../infrastructures/utils/file-utils";

const getAssetType = (
  mimeType: string
): "image" | "video" | "audio" | "text" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "text";
};

export class AssetMetadataDto {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;

  constructor(
    id: string,
    type: "image" | "video" | "audio" | "text",
    name: string,
    uploadedAt: string,
    lastUpdated: string,
    size: number
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.uploadedAt = uploadedAt;
    this.lastUpdated = lastUpdated;
    this.size = size;
  }
}

export class AssetDto extends AssetMetadataDto {
  private _dataUrl?: string;

  constructor(file: File);
  constructor(entity: {
    id: string;
    type: "image" | "video" | "audio" | "text";
    dataUrl: string;
    name: string;
    uploadedAt: string;
    lastUpdated: string;
    size: number;
  });
  constructor(
    arg:
      | File
      | {
          id: string;
          type: "image" | "video" | "audio" | "text";
          dataUrl: string;
          name: string;
          uploadedAt: string;
          lastUpdated: string;
          size: number;
        }
  ) {
    if (arg instanceof File) {
      super(
        "",
        getAssetType(arg.type),
        arg.name,
        new Date().toISOString(),
        new Date().toISOString(),
        arg.size
      );
      this._dataUrl = undefined;
    } else {
      super(
        arg.id,
        arg.type,
        arg.name,
        arg.uploadedAt,
        arg.lastUpdated,
        arg.size
      );
      this._dataUrl = arg.dataUrl;
    }
  }

  get dataUrl(): string | undefined {
    return this._dataUrl;
  }

  set dataUrl(value: string | undefined) {
    this._dataUrl = value;
  }

  async toAsset(): Promise<Asset> {
    return {
      id: this.id,
      type: this.type,
      dataUrl: this._dataUrl || "",
      name: this.name,
      uploadedAt: this.uploadedAt,
      lastUpdated: this.lastUpdated,
      size: this.size,
    };
  }
}

export async function createAssetDtoFromFile(file: File): Promise<AssetDto> {
  const assetDto = new AssetDto(file);
  assetDto.dataUrl = await FileUtils.readAsDataUrl(file);
  return assetDto;
}
