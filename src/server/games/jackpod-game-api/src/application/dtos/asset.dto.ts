import type { Asset } from "../../domain/entities/asset";

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

export function toAssetDto(entity: Asset): AssetDto {
  return {
    id: entity.id,
    type: entity.type,
    dataUrl: entity.dataUrl,
    name: entity.name,
    uploadedAt: entity.uploadedAt,
    lastUpdated: entity.lastUpdated,
    size: entity.size,
    meta: entity.meta,
  };
}

export function toAssetMetadataDto(entity: Asset): AssetMetadataDto {
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    uploadedAt: entity.uploadedAt,
    lastUpdated: entity.lastUpdated,
    size: entity.size,
    meta: entity.meta,
  };
}

export function toAsset(entity: AssetDto): Asset {
  return {
    id: entity.id,
    type: entity.type,
    dataUrl: entity.dataUrl,
    name: entity.name,
    uploadedAt: entity.uploadedAt,
    lastUpdated: entity.lastUpdated,
    size: entity.size,
    meta: entity.meta,
  };
}
