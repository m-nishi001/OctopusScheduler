import { injectable, inject } from "tsyringe";
import { AnswerSessionRepository } from "../../model/answer-session-repository";

@injectable()
export class GetWebAppUrlUseCase {
  constructor(
    @inject(AnswerSessionRepository) private readonly answerSessionRepository: AnswerSessionRepository
  ) {}

  /** 取得できない場合(失敗・非対応環境)はnull。 */
  async execute(): Promise<string | null> {
    try {
      return await this.answerSessionRepository.getWebAppUrl();
    } catch (e) {
      console.error("Failed to get web app url", e);
      return null;
    }
  }
}
