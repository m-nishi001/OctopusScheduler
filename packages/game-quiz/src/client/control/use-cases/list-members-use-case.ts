import { injectable, inject } from "tsyringe";
import { MemberRepository } from "../../model/member-repository";
import type { Member } from "../../../server/quiz-api-contract";

@injectable()
export class ListMembersUseCase {
  constructor(@inject(MemberRepository) private readonly memberRepository: MemberRepository) {}

  async execute(): Promise<Member[]> {
    return this.memberRepository.listMembers();
  }
}
