import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type {
  AcceptanceOption,
  AcceptanceState,
  ParticipantState,
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

  async issueJoinToken(quizId: string, scope: QuizSessionScope, rotate: boolean): Promise<string> {
    const { joinToken } = await this.quizApi.issueJoinToken({ quizId, scope, rotate });
    return joinToken;
  }

  async getParticipantState(
    quizId: string,
    scope: QuizSessionScope,
    joinToken: string,
    token?: string
  ): Promise<ParticipantState> {
    return this.quizApi.getParticipantState({ quizId, scope, joinToken, token });
  }

  async getOptionImage(
    quizId: string,
    scope: QuizSessionScope,
    joinToken: string,
    optionIndex: number
  ): Promise<string | null> {
    const { fileDataUrl } = await this.quizApi.getOptionImage({ quizId, scope, joinToken, optionIndex });
    return fileDataUrl;
  }

  async submit(
    quizId: string,
    scope: QuizSessionScope,
    joinToken: string,
    token: string,
    optionNo: number
  ): Promise<SubmittedAnswer> {
    return this.quizApi.submitAnswer({ quizId, scope, joinToken, token, optionNo });
  }

  async getAnswers(quizId: string, scope: QuizSessionScope): Promise<SubmittedAnswer[]> {
    return this.quizApi.getAnswers({ quizId, scope });
  }

  async getWebAppUrl(): Promise<string | null> {
    const { url } = await this.quizApi.getWebAppUrl();
    return url;
  }
}
