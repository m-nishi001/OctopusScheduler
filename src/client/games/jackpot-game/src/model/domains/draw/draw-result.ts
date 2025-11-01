import type { Member } from "../member/member";
import type { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  member: Member | null;
  prize: Prize;
  prizeRank: number;
  isWinner: boolean;
  isKakuhen: boolean;
}
