import type { MemberDto } from "../../../applications/dto/member-dto";

export interface IMemberRepository {
  fetchMembers(): Promise<MemberDto[]>;
  addMember?(member: MemberDto): Promise<void>;
  addMembers?(members: MemberDto[]): Promise<void>;
  updateMember(member: MemberDto): Promise<void>;
  updateMembers?(members: MemberDto[]): Promise<void>;
  deleteMember(memberId: string): Promise<void>;
  deleteMembers?(ids: string[]): Promise<void>;
}
