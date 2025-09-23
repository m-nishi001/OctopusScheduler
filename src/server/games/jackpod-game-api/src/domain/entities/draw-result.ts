import { Member } from "./member";
import { Prize } from "./prize";

export interface DrawResult {
  member: Member;
  prize: Prize;
  rank: string;
}
