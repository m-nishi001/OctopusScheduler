import type { MemberDto } from "../../member/dto/member-dto";
import type { Prize } from "../../../model/prize/prize";

export interface DrawResultDto {
  drawId: string;
  wonMember: MemberDto | null;
  wonPrize: Prize | null;
  isKakuhen: boolean;
  createdAt: number;
}
