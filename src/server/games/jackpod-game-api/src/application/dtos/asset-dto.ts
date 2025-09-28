import type { Asset } from '../../domain/entities/asset';

export function toAssetDto(entity: Asset): AssetDto {
    return {
        id: entity.id,
        type: entity.type,
        url: entity.url,
        name: entity.name,
        uploadedAt: entity.uploadedAt,
        size: entity.size,
        meta: entity.meta
    };
}

export function toAsset(entity: AssetDto): Asset {
    return {
        id: entity.id,
        type: entity.type,
        url: entity.url,
        name: entity.name,
        uploadedAt: entity.uploadedAt,
        size: entity.size,
        meta: entity.meta
    };
}
export interface AssetDto {
    id: string;
    type: 'image' | 'video' | 'audio' | 'text';
    url: string;
    name: string;
    uploadedAt: string;
    size: number;
    meta?: Record<string, any>;
}
