import type { Asset } from "../../domain/entities/asset";

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
  dataUrl: string;

  constructor(entity: Asset) {
    super(
      entity.id,
      entity.type,
      entity.name,
      entity.uploadedAt,
      entity.lastUpdated,
      entity.size
    );
    this.dataUrl = entity.dataUrl;
  }

  static toAsset(dto: AssetDto): Asset {
    return {
      id: dto.id,
      type: dto.type,
      dataUrl: dto.dataUrl,
      name: dto.name,
      uploadedAt: dto.uploadedAt,
      lastUpdated: dto.lastUpdated,
      size: dto.size,
    };
  }

  static toAssetMetadataDto(entity: Asset): AssetMetadataDto {
    return new AssetMetadataDto(
      entity.id,
      entity.type,
      entity.name,
      entity.uploadedAt,
      entity.lastUpdated,
      entity.size
    );
  }
}
