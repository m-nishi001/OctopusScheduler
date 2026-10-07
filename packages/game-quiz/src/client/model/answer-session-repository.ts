import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type {
  AcceptanceOption,
  AcceptanceState,
  QuizGameApi,
  QuizSessionScope,
  SubmittedAnswer,
} from "../../server/quiz-api-contract";

@injectable()
export class AnswerSessionRepository {
  constructor(@inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi) {}

  async start(quizId: string, scope: QuizSessionScope, options: AcceptanceOption[]): Promise<AcceptanceState> {
    return this.quizApi.startAcceptingAnswers({ quizId, scope, options });
  }

  async stop(quizId: string, scope: QuizSessionScope): Promise<AcceptanceState> {
    return this.quizApi.stopAcceptingAnswers({ quizId, scope });
  }

  async getState(quizId: string, scope: QuizSessionScope): Promise<AcceptanceState> {
    return this.quizApi.getAcceptanceState({ quizId, scope });
  }

  async submit(quizId: string, scope: QuizSessionScope, token: string, optionNo: number): Promise<SubmittedAnswer> {
    return this.quizApi.submitAnswer({ quizId, scope, token, optionNo });
  }

  async getAnswers(quizId: string, scope: QuizSessionScope): Promise<SubmittedAnswer[]> {
    return this.quizApi.getAnswers({ quizId, scope });
  }

  async getWebAppUrl(): Promise<string | null> {
    const { url } = await this.quizApi.getWebAppUrl();
    return url;
  }
}
