import type { Member } from "../member/member";
import type { Prize } from "../prize/prize";

export interface DrawResult {
  drawId: string;
  wonMember: Member | null;
  wonPrize: Prize | null;
  isKakuhen: boolean;
}
