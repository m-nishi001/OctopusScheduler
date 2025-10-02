export interface PrizeDto {
  id: string;
  name: string;
  probability: number;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  order: number;
}
