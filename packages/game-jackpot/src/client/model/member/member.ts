export interface Member {
  id: string;
  name: string;
  photoAssetId?: string;
  rank: number;
  /** 当選しやすさの重み（1〜100、大きいほど当選しやすい）。省略時は既定値（全員同じなら均等）。 */
  weight?: number;
  photoDataUrl?: string;
}
