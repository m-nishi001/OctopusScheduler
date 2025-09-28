import { MemberRepository } from '../../model/infrastructures/repository/member-repository';
import type { MemberDto } from './dto/member-dto';

export class MemberService {
  private readonly repo = new MemberRepository();

  async fetchMembers(): Promise<MemberDto[]> {
    const members = await this.repo.fetchMembers();
    if (!Array.isArray(members) || !members) return [];
    // Entity -> DTO変換（必要ならマッピング処理を追加）
    return members.map(m => ({ ...m }));
  }

  async saveMember(member: MemberDto): Promise<void> {
    await this.repo.saveMember(member);
  }

  async updateMember(member: MemberDto): Promise<void> {
    await this.repo.updateMember(member);
  }

  async deleteMember(memberId: string): Promise<void> {
    await this.repo.deleteMember(memberId);
  }
}
