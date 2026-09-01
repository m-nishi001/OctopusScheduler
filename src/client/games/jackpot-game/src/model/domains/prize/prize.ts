export interface Prize {
  id: string;
  name: string;
  rank?: number;
  imageAssetId?: string;
  image2AssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  animation?: string;
  order: number;
  winningImage1AssetId?: string;
  winningImage2AssetId?: string;
}
