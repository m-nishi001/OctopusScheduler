import type { Asset } from "../../../domains/asset/asset";

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

export class AssetDto {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
  dataUrl: string;
  referenceFrom: string[];

  constructor(entity: Asset) {
    this.id = entity.id;
    this.type = entity.type;
    this.name = entity.name;
    this.uploadedAt = entity.uploadedAt;
    this.lastUpdated = entity.lastUpdated;
    this.size = entity.size;
    this.dataUrl = entity.dataUrl;
    this.referenceFrom = entity.referenceFrom;
  }

  async toAsset(): Promise<Asset> {
    return {
      id: this.id,
      type: this.type,
      dataUrl: this.dataUrl,
      name: this.name,
      uploadedAt: this.uploadedAt,
      lastUpdated: this.lastUpdated,
      size: this.size,
      referenceFrom: this.referenceFrom,
    };
  }
}
