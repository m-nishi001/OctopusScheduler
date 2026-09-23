import { inject, injectable } from "tsyringe";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import type { IApiClient } from "@octopus/infrastructures/interfaces";
import type {
  SheetRow,
  QuizWithDataUrl,
  ProcessedResultDto,
  StopFormArgs,
  GetSheetDataArgs,
  StopAndGetProcessedResultsArgs,
  GetJsonArgs,
  AddJsonArgs,
} from "../../server/quiz-api-contract";
import type { SyncRequestDto } from "../control/dto/sync-request-dto";
import { computeTopResponders } from "./result-processor";
import { callQuizGame } from "./quiz-api-client";

@injectable()
export class FormRepository {
  constructor(
    @inject(IApiClientToken) private readonly apiClient: IApiClient
  ) {}

  async stopForm(quizId: string): Promise<void> {
    const args: StopFormArgs = { quizId };
    await callQuizGame<void>(this.apiClient, "stopForm", args);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const args: GetSheetDataArgs = { quizId };
    return await callQuizGame<SheetRow[]>(this.apiClient, "getSheetData", args);
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
      const stopPromise = callQuizGame<void>(this.apiClient, "stopForm", {
        quizId,
      }).catch((e) => ({ __error: e }));
      const mapPromise = callQuizGame<any[]>(
        this.apiClient,
        "getMappedResponses",
        { formId: quizId }
      ).catch((e) => ({ __error: e }));

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
      const args: StopAndGetProcessedResultsArgs = {
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue,
      };
      const resp = await callQuizGame<ProcessedResultDto[]>(this.apiClient, "stopAndGetProcessedResults",
        args
      );
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
      const args: GetJsonArgs = {};
      const jsonResp = await callQuizGame<{ json: string }>(this.apiClient, "getJson",
        args
      );
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      try {
        return JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        return [];
      }
    } else if (request.direction === "local-to-gas") {
      const text = JSON.stringify(request.quizzes ?? []);
      const args: AddJsonArgs = {
        driveJson: {
          fileName: "quizzes.json",
          jsonText: text,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        },
      };
      await callQuizGame<any>(this.apiClient, "addJson", args);
      return;
    }
    return;
  }
}
