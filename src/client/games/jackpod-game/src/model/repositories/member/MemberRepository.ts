import type { Member } from '../../domains/member/Member';

export interface MemberRepository {
  getMemberById(id: string): Promise<Member | null>;
  getAllMembers(): Promise<Member[]>;
}
