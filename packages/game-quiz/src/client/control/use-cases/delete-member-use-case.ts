import { injectable, inject } from "tsyringe";
import { MemberRepository } from "../../model/member-repository";

@injectable()
export class DeleteMemberUseCase {
  constructor(@inject(MemberRepository) private readonly memberRepository: MemberRepository) {}

  async execute(userId: string): Promise<void> {
    return this.memberRepository.deleteMember(userId);
  }
}
