import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { ParticipantState, QuizSessionScope } from "../../../server/quiz-api-contract";

@injectable()
export class GetParticipantStateUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(
    quizId: string,
    scope: QuizSessionScope,
    joinToken: string,
    token?: string
  ): Promise<ParticipantState> {
    return this.answerSessionRepository.getParticipantState(quizId, scope, joinToken, token);
  }
}
