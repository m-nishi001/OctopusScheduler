/**
 * game-jackpot固有のメンバー拡張設定。共有マスタ(id/name)には含まれない
 * rank/写真をmemberIdをキーに個別管理する。
 */
export interface JackpotMemberExtra {
  memberId: string;
  rank: number;
  photoAssetId?: string;
  photoDataUrl?: string;
}
