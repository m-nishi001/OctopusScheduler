import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";
import type { MemberDto } from "./dto/member-dto";

@injectable()
export class MemberService {
  constructor(@inject("IMemberRepository") private repo: IMemberRepository) {}

  async fetchMembers(): Promise<MemberDto[]> {
    await this.repo.syncMembers();
    return this.repo.getMembers();
  }

  async batchOperations(operations: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): Promise<void> {
    await this.repo.batchOperations(operations);
  }
}
