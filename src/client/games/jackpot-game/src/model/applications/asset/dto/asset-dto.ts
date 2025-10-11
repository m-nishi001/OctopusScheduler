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

export class AssetDto extends AssetMetadataDto {
  dataUrl: string;

  constructor(entity: {
    id: string;
    type: "image" | "video" | "audio" | "text";
    dataUrl: string;
    name: string;
    uploadedAt: string;
    lastUpdated: string;
    size: number;
  });
  constructor(arg: {
    id: string;
    type: "image" | "video" | "audio" | "text";
    dataUrl: string;
    name: string;
    uploadedAt: string;
    lastUpdated: string;
    size: number;
  }) {
    super(
      arg.id,
      arg.type,
      arg.name,
      arg.uploadedAt,
      arg.lastUpdated,
      arg.size
    );
    this.dataUrl = arg.dataUrl;
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
    };
  }
}
