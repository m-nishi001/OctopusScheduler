import { injectable } from "tsyringe";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type {
  SheetRow,
  SyncRequest,
  QuizWithDataUrl,
  ProcessedResultDto,
} from "quiz-game-api";

@injectable()
export class FormRepository {
  async stopForm(quizId: string): Promise<void> {
    const service = new GasFunctionService("quizGame_stopForm");
    await service.call<void>(quizId);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const service = new GasFunctionService("quizGame_getSheetData");
    return await service.call<SheetRow[]>(quizId);
  }

  async stopAndGetProcessedResults(
    quizId: string,
    quizStartTimeMs: number,
    answerKey: string,
    correctValue: string
  ): Promise<ProcessedResultDto[]> {
    const service = new GasFunctionService(
      "quizGame_stopAndGetProcessedResults"
    );
    try {
      console.info(
        "[FormRepository] calling _quizGame_stopAndGetProcessedResults",
        {
          quizId,
          quizStartTimeMs,
          answerKey,
          correctValue,
        }
      );
      const resp = await service.call<ProcessedResultDto[]>(
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue
      );
      console.info(
        "[FormRepository] _quizGame_stopAndGetProcessedResults response length=",
        Array.isArray(resp) ? resp.length : "unknown",
        resp
      );
      return resp;
    } catch (e) {
      console.error(
        "[FormRepository] _quizGame_stopAndGetProcessedResults failed",
        e
      );
      throw e;
    }
  }

  async syncQuizzes(request: SyncRequest): Promise<QuizWithDataUrl[] | void> {
    if (request.direction === "gas-to-local") {
      const jsonService = new GasFunctionService("_quizGame_getJson");
      const jsonResp = await jsonService.call<{ json: string }>({});
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      try {
        return JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        return [];
      }
    } else if (request.direction === "local-to-gas") {
      const addJson = new GasFunctionService("_quizGame_addJson");
      const text = JSON.stringify(request.quizzes ?? []);
      await addJson.call<any>({ fileName: "quizzes.json", jsonText: text });
      return;
    }
    return;
  }
}
