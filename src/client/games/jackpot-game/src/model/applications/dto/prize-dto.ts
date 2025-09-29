export interface PrizeDto {
  id: string;
  name: string;
  probability: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  order: number;
}
