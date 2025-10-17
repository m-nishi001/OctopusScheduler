import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";

@injectable()
export class MemberDeleteService {
  constructor(@inject("IMemberRepository") private repo: IMemberRepository) {}

  async deleteMember(id: string): Promise<void> {
    await this.repo.deleteMembers([id]);
  }

  async deleteMembers(ids: string[]): Promise<void> {
    await this.repo.deleteMembers(ids);
  }
}
