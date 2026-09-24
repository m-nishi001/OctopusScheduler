import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { SubmittedAnswer } from "../../../server/quiz-api-contract";

@injectable()
export class GetSubmittedAnswersUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string): Promise<SubmittedAnswer[]> {
    return this.answerSessionRepository.getAnswers(quizId);
  }
}
