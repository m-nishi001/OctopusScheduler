import { inject, injectable } from "tsyringe";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import type { IApiClient } from "@octopus/infrastructures/interfaces";
import { callQuizGame } from "../infrastructures/quiz-api-client";

@injectable()
export class QuizResultService {
  constructor(
    @inject(IApiClientToken) private readonly apiClient: IApiClient
  ) {}

  async getMappedResponses(formId: string): Promise<any[]> {
    return await callQuizGame<any[]>(this.apiClient, "getMappedResponses", {
      formId,
    });
  }

  async loadEmailNameMap(): Promise<void> {
    await callQuizGame(this.apiClient, "loadEmailNameMap", {});
  }
}
