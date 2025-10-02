import { AssetDto, AssetMetadataDto } from "./asset.dto";

export function toAssetEntity(dto: AssetDto): any {
  return {
    id: dto.id,
    type: dto.type,
    dataUrl: dto.dataUrl,
    name: dto.name,
    uploadedAt: dto.uploadedAt,
    lastUpdated: dto.lastUpdated,
    size: dto.size,
    meta: dto.meta ?? {},
  };
}

export function toAssetDto(entity: any): AssetDto {
  return {
    id: entity.id,
    type: entity.type,
    dataUrl: entity.dataUrl,
    name: entity.name,
    uploadedAt: entity.uploadedAt,
    lastUpdated: entity.lastUpdated,
    size: entity.size,
    meta: entity.meta ?? {},
  };
}

export function toAssetMetadataDto(entity: any): AssetMetadataDto {
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    uploadedAt: entity.uploadedAt,
    lastUpdated: entity.lastUpdated,
    size: entity.size,
    meta: entity.meta ?? {},
  };
}
