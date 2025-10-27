import type { Member } from "../member/member";
import type { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  member: Member;
  prize: Prize;
  prizeRank: number | null;
  memberRank: number | null;
  order: number;
  isWinner: boolean;
  isKakuhen?: boolean;
}
