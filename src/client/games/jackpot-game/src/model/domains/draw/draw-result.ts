import type { Member } from "../member/member";
import type { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  member: Member | null;
  prize: Prize | null;
  prizeRank: number | null;
  memberRank: number;
  isWinner: boolean;
  isKakuhen: boolean;
}
