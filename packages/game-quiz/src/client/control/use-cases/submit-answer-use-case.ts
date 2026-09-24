import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { SubmittedAnswer } from "../../../server/quiz-api-contract";

@injectable()
export class SubmitAnswerUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string, token: string, optionNo: number): Promise<SubmittedAnswer> {
    return this.answerSessionRepository.submit(quizId, token, optionNo);
  }
}
