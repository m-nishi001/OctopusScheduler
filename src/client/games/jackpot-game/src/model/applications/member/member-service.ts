import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";
import type { MemberDto } from "./dto/member-dto";
import { fromMember, toMember } from "./dto/member-dto";

@injectable()
export class MemberService {
  constructor(@inject("IMemberRepository") private repo: IMemberRepository) {}

  async fetchMembers(): Promise<MemberDto[]> {
    const members = await this.repo.getMembers();
    return members.map(fromMember);
  }

  async addMember(member: MemberDto): Promise<void> {
    await this.repo.addMembers([toMember(member)]);
  }

  async updateMember(id: string, member: MemberDto): Promise<void> {
    const updateOps = [{ id, updateFn: (_: any) => toMember(member) }];
    await this.repo.updateMembers(updateOps);
  }

  async deleteMember(id: string): Promise<void> {
    await this.repo.deleteMembers([id]);
  }

  async syncMembers(): Promise<void> {
    // サーバーから全メンバーを取得してローカルストレージに同期
    await this.repo.syncMembers();
  }
}
