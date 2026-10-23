import type { DrawResultDto } from "../dto/draw-result-dto";
import type { Prize } from "../../../model/prize/prize";
import type { Member } from "../../../model/member/member";
import { fromMember } from "../../member/dto/member-dto";

/** 当選者と景品から、抽選結果を作る。確変なら `isKakuhen`。 */
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
