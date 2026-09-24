import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type {
  AcceptanceState,
  QuizGameApi,
  SubmittedAnswer,
} from "../../server/quiz-api-contract";

@injectable()
export class AnswerSessionRepository {
  constructor(@inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi) {}

  async start(quizId: string): Promise<AcceptanceState> {
    return this.quizApi.startAcceptingAnswers({ quizId });
  }

  async stop(quizId: string): Promise<AcceptanceState> {
    return this.quizApi.stopAcceptingAnswers({ quizId });
  }

  async getState(quizId: string): Promise<AcceptanceState> {
    return this.quizApi.getAcceptanceState({ quizId });
  }

  async submit(quizId: string, token: string, optionNo: number): Promise<SubmittedAnswer> {
    return this.quizApi.submitAnswer({ quizId, token, optionNo });
  }

  async getAnswers(quizId: string): Promise<SubmittedAnswer[]> {
    return this.quizApi.getAnswers({ quizId });
  }
}
