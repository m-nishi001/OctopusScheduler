import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { fromMember, toMember } from "./dto/member-dto";
import type { Member } from "../../domains/member/member";

@injectable()
export class MemberService {
  constructor(@inject("IMemberRepository") private repo: IMemberRepository) {}

  async fetchMembers(): Promise<MemberDto[]> {
    const members = await this.repo.getMembers();
    return members.map(fromMember);
  }

  async addMember(member: MemberDto): Promise<MemberDto> {
    const addedMembers = await this.repo.addMembers([toMember(member)]);
    return fromMember(addedMembers[0]);
  }

  async updateMember(id: string, member: MemberDto): Promise<void> {
    const updateOps = [{ id, updateFn: (_: any) => toMember(member) }];
    await this.repo.updateMembers(updateOps);
  }

  async saveMember(member: MemberDto): Promise<Member> {
    const memberToSave = { ...member };
    const addedMembers = await this.repo.addMembers([toMember(memberToSave)]);
    return addedMembers[0];
  }

  async deleteMember(id: string): Promise<void> {
    await this.repo.deleteMembers([id]);
  }

  async deleteMembers(ids: string[]): Promise<void> {
    await this.repo.deleteMembers(ids);
  }
}
