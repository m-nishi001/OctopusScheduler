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
  prize: PrizeDto | null;
  prizeRank: number | null;
  memberRank: number | null;
  isWinner: boolean;
  isKakuhen: boolean;
  createdAt: number;
}

export const toDrawResultDto = (drawResult: DrawResult): DrawResultDto => ({
  drawId: drawResult.drawId,
  member: toMember(drawResult.member),
  prize: toPrize(drawResult.prize),
  prizeRank: drawResult.prizeRank,
  memberRank: drawResult.memberRank,
  isWinner: drawResult.isWinner,
  isKakuhen: drawResult.isKakuhen ?? false,
  createdAt: Date.now(),
});

export const fromDrawResultDto = (dto: DrawResultDto): DrawResult => {
  if (!dto.member || !dto.prize) {
    throw new Error("DrawResultDto must have member and prize");
  }
  return {
    drawId: dto.drawId,
    member: fromMember(dto.member),
    prize: fromPrize(dto.prize),
    prizeRank: dto.prizeRank,
    memberRank: dto.memberRank,
    isWinner: dto.isWinner,
    isKakuhen: dto.isKakuhen,
  };
};
