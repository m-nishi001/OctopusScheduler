import type { MemberDto } from "../../member/dto/member-dto";
import type { PrizeDto } from "../../prize/dto/prize-dto";
import { toMember } from "../../member/dto/member-dto";
import { toPrize } from "../../prize/dto/prize-dto";
import { fromMember } from "../../member/dto/member-dto";
import { fromPrize } from "../../prize/dto/prize-dto";
import type { DrawResult } from "domains/draw/draw-result";

export interface DrawResultDto {
  drawId: string;
  member: MemberDto | null;
  prize: PrizeDto;
  prizeRank: number;
  isWinner: boolean;
  isKakuhen: boolean;
  createdAt: number;
}

export const toDrawResultDto = (drawResult: DrawResult): DrawResultDto => ({
  drawId: drawResult.drawId,
  member: drawResult.member ? toMember(drawResult.member) : null,
  prize: toPrize(drawResult.prize),
  prizeRank: drawResult.prizeRank,
  isWinner: drawResult.isWinner,
  isKakuhen: drawResult.isKakuhen,
  createdAt: Date.now(),
});

export const fromDrawResultDto = (dto: DrawResultDto): DrawResult => {
  if (!dto.prize) {
    throw new Error("DrawResultDto must have prize");
  }
  if (dto.prizeRank === null || dto.prizeRank === undefined) {
    throw new Error("DrawResultDto must have prizeRank");
  }
  return {
    drawId: dto.drawId,
    member: dto.member ? fromMember(dto.member) : null,
    prize: fromPrize(dto.prize),
    prizeRank: dto.prizeRank,
    isWinner: dto.isWinner,
    isKakuhen: dto.isKakuhen,
  };
};
