/**
 * game-jackpot固有のメンバー拡張設定。共有マスタ(id/name)には含まれない
 * 当選しやすさ(weight)をmemberIdをキーに個別管理する(写真は共通の名簿が持つ)。
 */
export interface JackpotMemberExtra {
  memberId: string;
  weight?: number;
}
