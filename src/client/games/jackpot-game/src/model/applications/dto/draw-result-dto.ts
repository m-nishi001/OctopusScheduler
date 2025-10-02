import type { MemberDto } from "./member-dto";
import type { PrizeDto } from "./prize-dto";

export interface DrawResultDto {
  drawId: string;
  member: MemberDto;
  prize: PrizeDto;
  rank: number | null;
  order: number;
  isWinner: boolean;
}
