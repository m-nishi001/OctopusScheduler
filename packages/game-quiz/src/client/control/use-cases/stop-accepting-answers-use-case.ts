import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { AcceptanceState } from "../../../server/quiz-api-contract";

@injectable()
export class StopAcceptingAnswersUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string): Promise<AcceptanceState> {
    return this.answerSessionRepository.stop(quizId);
  }
}
