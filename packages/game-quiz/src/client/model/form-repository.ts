import { inject, injectable } from "tsyringe";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type {
  QuizGameApi,
  SheetRow,
  QuizWithDataUrl,
  ProcessedResultDto,
  StopAndGetProcessedResultsArgs,
} from "../../server/quiz-api-contract";
import type { SyncRequestDto } from "../control/dto/sync-request-dto";
import { computeTopResponders } from "./result-processor";

@injectable()
export class FormRepository {
  constructor(
    @inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi
  ) {}

  async stopForm(quizId: string): Promise<void> {
    await this.quizApi.stopForm({ quizId });
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    return await this.quizApi.getSheetData({ quizId });
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
      const stopPromise = this.quizApi
        .stopForm({ quizId })
        .catch((e) => ({ __error: e }));
      const mapPromise = this.quizApi
        .getMappedResponses({ formId: quizId })
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
      const args: StopAndGetProcessedResultsArgs = {
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue,
      };
      const resp = await this.quizApi.stopAndGetProcessedResults(args);
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
      const jsonResp = await this.quizApi.getJson({});
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      try {
        return JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        return [];
      }
    } else if (request.direction === "local-to-gas") {
      const text = JSON.stringify(request.quizzes ?? []);
      await this.quizApi.addJson({
        driveJson: {
          fileName: "quizzes.json",
          jsonText: text,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        },
      });
      return;
    }
    return;
  }
}
