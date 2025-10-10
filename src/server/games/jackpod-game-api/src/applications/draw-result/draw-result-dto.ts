import { MemberDto } from "../member/member-dto";
import { PrizeDto } from "../prize/prize-dto";

export interface DrawResultDto {
  drawId: string;
  member: MemberDto;
  prize: PrizeDto;
  rank: number | null;
  order: number;
  isWinner: boolean;
}
