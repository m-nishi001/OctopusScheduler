import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type { Member, QuizGameApi } from "../../server/quiz-api-contract";

@injectable()
export class MemberRepository {
  constructor(@inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi) {}

  async listMembers(): Promise<Member[]> {
    return this.quizApi.listMembers({});
  }

  async addMember(member: Member): Promise<Member> {
    return this.quizApi.addMember(member);
  }

  async updateMember(member: Member): Promise<Member> {
    return this.quizApi.updateMember(member);
  }

  async deleteMember(userId: string): Promise<void> {
    return this.quizApi.deleteMember({ userId });
  }
}
