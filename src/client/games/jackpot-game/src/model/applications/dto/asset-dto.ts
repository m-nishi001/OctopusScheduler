export interface AssetMetadataDto {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
  meta?: Record<string, any>;
}

export interface AssetDto extends AssetMetadataDto {
  dataUrl: string;
}
