import type {
  ProcessedResultDto,
  QuizWithDataUrl,
  SheetRow,
} from "../../../server/quiz-api-contract";
import type { SyncRequestDto } from "../../applications/dtos/sync-request-dto";

export const IFormRepositoryToken = Symbol("IFormRepository");

export interface IFormRepository {
  stopForm(quizId: string): Promise<void>;
  getSheetData(quizId: string): Promise<SheetRow[]>;
  stopAndGetProcessedResults(
    quizId: string,
    quizStartTimeMs: number,
    answerKey: string,
    correctValue: string
  ): Promise<ProcessedResultDto[]>;
  syncQuizzes(request: SyncRequestDto): Promise<QuizWithDataUrl[] | void>;
}
