import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type { QuizGameApi } from "../../server/quiz-api-contract";

@injectable()
export class QuizResultService {
  constructor(
    @inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi
  ) {}

  async getMappedResponses(formId: string): Promise<Record<string, unknown>[]> {
    return await this.quizApi.getMappedResponses({ formId });
  }

  async loadEmailNameMap(): Promise<void> {
    await this.quizApi.loadEmailNameMap({});
  }
}
