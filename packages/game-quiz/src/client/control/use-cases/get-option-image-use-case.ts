import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { QuizSessionScope } from "../../../server/quiz-api-contract";

@injectable()
export class GetOptionImageUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(
    quizId: string,
    scope: QuizSessionScope,
    joinToken: string,
    optionIndex: number
  ): Promise<string | null> {
    return this.answerSessionRepository.getOptionImage(quizId, scope, joinToken, optionIndex);
  }
}
