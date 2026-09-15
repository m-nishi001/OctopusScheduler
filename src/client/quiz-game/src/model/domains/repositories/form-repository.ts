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
import { computeTopResponders } from "../../../services/resultProcessor";

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
    // Try a parallel approach: stop form and get mapped responses in parallel,
    // then compute top responders on the client for faster perceived latency.
    try {
      const stopService = new GasFunctionService("quizGame_stopForm");
      const mapService = new GasFunctionService("quizGame_getMappedResponses");

      const stopPromise = stopService
        .call<void>({ quizId })
        .catch((e) => ({ __error: e }));
      const mapPromise = mapService
        .call<any[]>({ formId: quizId })
        .catch((e) => ({ __error: e }));

      const [stopResp, mapResp] = await Promise.all([stopPromise, mapPromise]);

      // If mapped responses succeeded, perform client-side aggregation
      if (mapResp && !(mapResp as any).__error && Array.isArray(mapResp)) {
        const answers = mapResp as any[];

        // Determine answerKey/correctValue are provided by caller; pass through
        const top = computeTopResponders(answers, {
          answerKey,
          correctValue,
          limit: 10,
          uniqueByEmail: true,
          excludeMissingEmail: true,
          quizStartTimeMs,
        });

        const processed: ProcessedResultDto[] = top.map(
          (r: any, idx: number) => {
            const rawTs = Number(r.__timestampMs);
            const timestampMs = Number.isFinite(rawTs) ? rawTs : NaN;
            const timeToAnswerMs = Number.isFinite(timestampMs)
              ? timestampMs - quizStartTimeMs
              : NaN;
            return {
              playerId: null,
              playerName: r.name || null,
              isCorrect: true,
              timeToAnswerMs,
              timestampMs,
              rank: idx + 1,
              rawRow: r.__raw,
            } as ProcessedResultDto;
          }
        );

        console.info(
          "[FormRepository] stopAndGetProcessedResults: returning client-processed results count=",
          processed.length
        );
        return processed;
      }

      // Fallback: call the server-side combined function
      const service = new GasFunctionService(
        "quizGame_stopAndGetProcessedResults"
      );
      const args: StopAndGetProcessedResultsArgs = {
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue,
      };
      const resp = await service.call<ProcessedResultDto[]>(args);
      return resp;
    } catch (e) {
      console.error("[FormRepository] stopAndGetProcessedResults failed", e);
      throw e;
    }
  }

  async syncQuizzes(
    request: SyncRequestDto
  ): Promise<QuizWithDataUrl[] | void> {
    if (request.direction === "gas-to-local") {
      const jsonService = new GasFunctionService("quizGame_getJson");
      const args: GetJsonArgs = {};
      const jsonResp = await jsonService.call<{ json: string }>(args);
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      try {
        return JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        return [];
      }
    } else if (request.direction === "local-to-gas") {
      const addJson = new GasFunctionService("quizGame_addJson");
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
