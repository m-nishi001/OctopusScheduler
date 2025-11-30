import { injectable } from "tsyringe";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type {
  SheetRow,
  QuizWithDataUrl,
  ProcessedResultDto,
  StopFormArgs,
  GetSheetDataArgs,
  StopAndGetProcessedResultsArgs,
  GetJsonArgs,
  AddJsonArgs,
} from "quiz-game-api";
import type { SyncRequestDto } from "../../applications/dto/sync-request-dto";

@injectable()
export class FormRepository {
  async stopForm(quizId: string): Promise<void> {
    const service = new GasFunctionService("quizGame_stopForm");
    const args: StopFormArgs = { quizId };
    await service.call<void>(args);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const service = new GasFunctionService("quizGame_getSheetData");
    const args: GetSheetDataArgs = { quizId };
    return await service.call<SheetRow[]>(args);
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
      const args: StopAndGetProcessedResultsArgs = {
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue,
      };
      const resp = await service.call<ProcessedResultDto[]>(args);
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

  async syncQuizzes(
    request: SyncRequestDto
  ): Promise<QuizWithDataUrl[] | void> {
    if (request.direction === "gas-to-local") {
      const jsonService = new GasFunctionService("_quizGame_getJson");
      const args: GetJsonArgs = {};
      const jsonResp = await jsonService.call<{ json: string }>(args);
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      try {
        return JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        return [];
      }
    } else if (request.direction === "local-to-gas") {
      const addJson = new GasFunctionService("_quizGame_addJson");
      const text = JSON.stringify(request.quizzes ?? []);
      const args: AddJsonArgs = {
        driveJson: {
          fileName: "quizzes.json",
          jsonText: text,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        },
      };
      await addJson.call<any>(args);
      return;
    }
    return;
  }
}
