/**
 * game-jackpot固有のメンバー拡張設定。共有マスタ(id/name)には含まれない
 * 当選しやすさ(weight)をmemberIdをキーに個別管理する(写真は共通の名簿が持つ)。
 */
export interface JackpotMemberExtra {
  memberId: string;
  weight?: number;
  /** ジャックポットの抽選の対象か(省略・既定は true)。管理者かどうかとは無関係に、メンバーごとに明示する。 */
  eligible?: boolean;
}
