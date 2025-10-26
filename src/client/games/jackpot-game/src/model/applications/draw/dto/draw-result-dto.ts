import type { MemberDto } from "../../member/dto/member-dto";
import type { PrizeDto } from "../../prize/dto/prize-dto";
import { toMember } from "../../member/dto/member-dto";
import { toPrize } from "../../prize/dto/prize-dto";
import { fromMember } from "../../member/dto/member-dto";
import { fromPrize } from "../../prize/dto/prize-dto";
import type { DrawResult } from "../../../domains/draw/draw-result";

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

export const toDrawResultDto = (drawResult: DrawResult): DrawResultDto => ({
  drawId: drawResult.drawId,
  member: toMember(drawResult.member),
  prize: toPrize(drawResult.prize),
  rank: drawResult.rank,
  order: drawResult.order,
  isWinner: drawResult.isWinner,
});

export const fromDrawResultDto = (dto: DrawResultDto): DrawResult => {
  if (!dto.member || !dto.prize) {
    throw new Error("DrawResultDto must have member and prize");
  }
  return {
    drawId: dto.drawId,
    member: fromMember(dto.member),
    prize: fromPrize(dto.prize),
    rank: dto.rank,
    order: dto.order,
    isWinner: dto.isWinner,
  };
};
