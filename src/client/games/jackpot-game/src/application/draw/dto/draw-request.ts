import type { PrizeDto } from "../../prize/dto/prize-dto";
import type { MemberDto } from "../../member/dto/member-dto";

export interface DrawRequest {
  prizes: PrizeDto[];
  members: MemberDto[];
  memberWeights?: number[];
  prizeWeights?: number[];
}
