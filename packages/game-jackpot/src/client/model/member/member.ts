export interface Member {
  id: string;
  name: string;
  /** 顔写真(共通の名簿の Member.photo。写真の中身は名簿の写真キャッシュから引く)。 */
  photo?: string;
  /** メンバー抽選の当選しやすさ（1〜10、標準5。大きいほど選ばれやすい）。省略時は既定値（全員同じなら均等）。 */
  weight?: number;
  /** ジャックポットの抽選の対象か(省略・既定は true)。管理者かどうかとは無関係。 */
  eligible?: boolean;
}
