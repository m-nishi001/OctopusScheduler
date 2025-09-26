import { Member } from "./member";
import { Prize } from "./prize";

export interface DrawResult {
  drawId: string;
  member: Member;
  prize: Prize;
  rank: string;
}
