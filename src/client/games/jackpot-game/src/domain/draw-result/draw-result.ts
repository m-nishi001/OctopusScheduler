import type { Member } from "../member/member";
import type { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  member: Member;
  prize: Prize;
  rank: number | null;
  order: number;
  isWinner: boolean;
}
