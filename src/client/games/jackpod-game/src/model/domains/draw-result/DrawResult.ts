import type { Member } from '../member/Member';
import type { Prize } from '../prize/Prize';

export interface DrawResult {
  member: Member;
  prize: Prize;
  rank: string;
}
