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
  member: drawResult.member ? toMember(drawResult.member) : null,
  prize: drawResult.prize ? toPrize(drawResult.prize) : null,
  prizeRank: drawResult.prizeRank,
  memberRank: drawResult.memberRank,
  isWinner: drawResult.isWinner,
  isKakuhen: drawResult.isKakuhen,
  createdAt: Date.now(),
});

export const fromDrawResultDto = (dto: DrawResultDto): DrawResult => {
  return {
    drawId: dto.drawId,
    member: dto.member ? fromMember(dto.member) : null,
    prize: dto.prize ? fromPrize(dto.prize) : null,
    prizeRank: dto.prizeRank,
    memberRank: dto.memberRank ?? 0,
    isWinner: dto.isWinner,
    isKakuhen: dto.isKakuhen,
  };
};
