import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";
import type { QuizSessionScope } from "../../../server/quiz-api-contract";

@injectable()
export class IssueJoinTokenUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  /** rotate=true でQR表示時に新しいトークンへ切り替え、false で現在のトークンを取得する。 */
  async execute(quizId: string, scope: QuizSessionScope, rotate: boolean): Promise<string> {
    return this.answerSessionRepository.issueJoinToken(quizId, scope, rotate);
  }
}
