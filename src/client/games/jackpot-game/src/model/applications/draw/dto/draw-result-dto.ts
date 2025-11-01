import type { MemberDto } from "../../member/dto/member-dto";
import type { PrizeDto } from "../../prize/dto/prize-dto";
import { toMember } from "../../member/dto/member-dto";
import { toPrize } from "../../prize/dto/prize-dto";
import { fromMember } from "../../member/dto/member-dto";
import { fromPrize } from "../../prize/dto/prize-dto";
import type { DrawResult } from "domains/draw/draw-result";

export interface DrawResultDto {
  drawId: string;
  wonMember: MemberDto | null;
  wonPrize: PrizeDto | null;
  isKakuhen: boolean;
  createdAt: number;
}

export const toDrawResultDto = (drawResult: DrawResult): DrawResultDto => ({
  drawId: drawResult.drawId,
  wonMember: drawResult.wonMember ? toMember(drawResult.wonMember) : null,
  wonPrize: drawResult.wonPrize ? toPrize(drawResult.wonPrize) : null,
  isKakuhen: drawResult.isKakuhen,
  createdAt: Date.now(),
});

export const fromDrawResultDto = (dto: DrawResultDto): DrawResult => {
  return {
    drawId: dto.drawId,
    wonMember: dto.wonMember ? fromMember(dto.wonMember) : null,
    wonPrize: dto.wonPrize ? fromPrize(dto.wonPrize) : null,
    isKakuhen: dto.isKakuhen,
  };
};
