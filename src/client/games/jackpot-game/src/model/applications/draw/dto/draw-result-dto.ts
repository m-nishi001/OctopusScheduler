import type { MemberDto } from "../../member/dto/member-dto";
import type { Prize } from "../../../domains/prize/prize";
import { toMember } from "../../member/dto/member-dto";
import { fromMember } from "../../member/dto/member-dto";
import type { DrawResult } from "domains/draw/draw-result";

export interface DrawResultDto {
  drawId: string;
  wonMember: MemberDto | null;
  wonPrize: Prize | null;
  isKakuhen: boolean;
  createdAt: number;
}

export const toDrawResultDto = (
  drawResult: DrawResult
): DrawResultDto | null => {
  if (drawResult.wonPrize === null) {
    return null;
  }
  return {
    drawId: drawResult.drawId,
    wonMember: drawResult.wonMember ? toMember(drawResult.wonMember) : null,
    wonPrize: drawResult.wonPrize,
    isKakuhen: drawResult.isKakuhen,
    createdAt: Date.now(),
  };
};

export const fromDrawResultDto = (
  dto: DrawResultDto | null
): DrawResult | null => {
  if (!dto) {
    return null;
  }
  return {
    drawId: dto.drawId,
    wonMember: dto.wonMember ? fromMember(dto.wonMember) : null,
    wonPrize: dto.wonPrize,
    isKakuhen: dto.isKakuhen,
  };
};
