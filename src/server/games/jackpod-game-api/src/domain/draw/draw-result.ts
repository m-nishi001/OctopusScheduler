import { Member } from "../member/member";
import { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  member: Member;
  prize: Prize;
  rank: number | null;
  order: number;
  isWinner: boolean;
}
