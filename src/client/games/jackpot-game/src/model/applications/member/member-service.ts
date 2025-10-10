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

  async batchOperations(operations: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): Promise<void> {
    const addEntities = operations.add.map(toMember);
    await this.repo.addMembers(addEntities);

    const updateOps = operations.update.map((dto) => ({
      id: dto.id,
      updateFn: (_: any) => toMember(dto),
    }));
    await this.repo.updateMembers(updateOps);

    await this.repo.deleteMembers(operations.delete);
  }
}
