import type { MemberDto } from "../../../applications/dto/member-dto";

export interface IMemberRepository {
  fetchMembers(): Promise<MemberDto[]>;
  saveMember(member: MemberDto): Promise<void>;
  addMember?(member: MemberDto): Promise<void>;
  updateMember(member: MemberDto): Promise<void>;
  deleteMember(memberId: string): Promise<void>;
}
