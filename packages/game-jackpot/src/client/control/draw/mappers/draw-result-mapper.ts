import type { DrawResultDto } from "../dto/draw-result-dto";
import type { Prize } from "../../../model/prize/prize";
import type { Member } from "../../../model/member/member";
import { fromMember } from "../../member/dto/member-dto";

/** 確変のために予約した景品の、まだ当選者のいない抽選結果。 */
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

/** 予約済みの抽選結果に、当選者を入れて確定させる。 */
export const mapToUpdatedDrawResult = (
  existing: DrawResultDto,
  member: Member,
  isKakuhen = true
): DrawResultDto => ({
  ...existing,
  wonMember: fromMember(member),
  isKakuhen,
});
