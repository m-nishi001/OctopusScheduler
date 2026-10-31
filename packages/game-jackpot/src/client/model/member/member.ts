export interface Member {
  id: string;
  name: string;
  /** 顔写真(共通の名簿の Member.photo。写真の中身は名簿の写真キャッシュから引く)。 */
  photo?: string;
  rank: number;
  /** 当選しやすさの重み（1〜100、大きいほど当選しやすい）。省略時は既定値（全員同じなら均等）。 */
  weight?: number;
}
