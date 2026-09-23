import type { DrawResultDto } from "../dto/draw-result-dto";
import type { Prize } from "../../../model/prize/prize";
import type { Member } from "../../../model/member/member";
import { fromMember } from "../../member/dto/member-dto";

export const mapToReservedDrawResult = (
  drawId: string,
  prize: Prize
): DrawResultDto => ({
  drawId,
  wonMember: null,
  wonPrize: prize,
  isKakuhen: false,
  createdAt: Date.now(),
});

export const mapToDrawResult = (
  drawId: string,
  member: Member,
  prize: Prize,
  isKakuhen = false
): DrawResultDto => ({
  drawId,
  wonMember: fromMember(member),
  wonPrize: prize,
  isKakuhen,
  createdAt: Date.now(),
});

export const mapToUpdatedDrawResult = (
  existing: DrawResultDto,
  member: Member,
  isKakuhen = true
): DrawResultDto => ({
  ...existing,
  wonMember: fromMember(member),
  isKakuhen,
});
