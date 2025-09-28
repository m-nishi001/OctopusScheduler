export interface Prize {
    id: string;
    name: string;
    rank: number;
    imageAssetId?: string;
    description?: string;
    order: number;
    bgmAssetId?: string;
    seAssetIds?: string[];
}
