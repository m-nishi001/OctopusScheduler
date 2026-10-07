import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { QuizSessionScope, AcceptanceOption, AcceptanceState } from "../../../server/quiz-api-contract";

@injectable()
export class StartAcceptingAnswersUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  async execute(quizId: string, scope: QuizSessionScope, options: AcceptanceOption[]): Promise<AcceptanceState> {
    return this.answerSessionRepository.start(quizId, scope, options);
  }
}
