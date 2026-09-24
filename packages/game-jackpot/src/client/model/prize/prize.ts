export interface Prize {
  id: string;
  name: string;
  /** 当選確率の重み。目安は1〜100で、大きいほど当選しやすい。未設定時は既定値が使われる。 */
  weight?: number;
  imageAssetId?: string;
  image2AssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  animation?: string;
  order: number;
  winningImage1AssetId?: string;
  winningImage2AssetId?: string;
}
