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
  // animation key to choose which draw animation to use for this prize (e.g. 'roulette')
  animation?: string;
  order: number;
  imageDataUrl?: string;
}
