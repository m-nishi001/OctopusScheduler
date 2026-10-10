import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { QuizSessionScope, AcceptanceState } from "../../../server/quiz-api-contract";

@injectable()
export class GetAcceptanceStateUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string, scope: QuizSessionScope): Promise<AcceptanceState> {
    return this.answerSessionRepository.getState(quizId, scope);
  }
}
