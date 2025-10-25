export interface Prize {
  id: string;
  name: string;
  probability: number;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  isAssigned?: boolean;
  isReserved?: boolean;
  order: number;
  imageDataUrl?: string;
}
