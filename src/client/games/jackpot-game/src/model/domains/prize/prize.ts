export interface Prize {
  id: string;
  name: string;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  animation?: string;
  order: number;
  imageDataUrl?: string;
}
