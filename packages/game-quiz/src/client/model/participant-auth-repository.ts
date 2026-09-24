import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type { ParticipantSession, QuizGameApi } from "../../server/quiz-api-contract";

@injectable()
export class ParticipantAuthRepository {
  constructor(@inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi) {}

  async login(userId: string): Promise<ParticipantSession> {
    return this.quizApi.loginParticipant({ userId });
  }

  async resolveToken(token: string): Promise<ParticipantSession> {
    return this.quizApi.resolveDeviceToken({ token });
  }
}
