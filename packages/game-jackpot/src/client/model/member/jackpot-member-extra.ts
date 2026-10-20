/**
 * game-jackpot固有のメンバー拡張設定。共有マスタ(id/name)には含まれない
 * rank/当選しやすさ(weight)/写真をmemberIdをキーに個別管理する。
 */
export interface JackpotMemberExtra {
  memberId: string;
  rank: number;
  weight?: number;
  photoAssetId?: string;
  photoDataUrl?: string;
}
