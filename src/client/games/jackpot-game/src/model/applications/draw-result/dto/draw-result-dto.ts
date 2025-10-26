import type { MemberDto } from "../../member/dto/member-dto";
import type { PrizeDto } from "../../prize/dto/prize-dto";

export interface DrawResultDto {
  drawId: string;
  member: MemberDto | null;
  prize?: PrizeDto | null;
  rank: number | null;
  order: number;
  isWinner: boolean;
  // optional flags for reservation / animation metadata
  isReserved?: boolean;
  reservedFor?: string | null; // member id
  animationId?: string | null;
  bgm1AssetId?: string | null;
  bgm2AssetId?: string | null;
}
