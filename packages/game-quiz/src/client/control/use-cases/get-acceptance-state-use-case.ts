import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { AcceptanceState } from "../../../server/quiz-api-contract";

@injectable()
export class GetAcceptanceStateUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string): Promise<AcceptanceState> {
    return this.answerSessionRepository.getState(quizId);
  }
}
