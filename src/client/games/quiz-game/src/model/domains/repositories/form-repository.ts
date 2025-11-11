import { injectable } from "tsyringe";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type { SheetRow, SyncRequest, QuizWithDataUrl } from "quiz-game-api";

@injectable()
export class FormRepository {
  async stopForm(quizId: string): Promise<void> {
    const service = new GasFunctionService("_quizGame_stopForm");
    await service.call<void>(quizId);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const service = new GasFunctionService("_quizGame_getSheetData");
    return await service.call<SheetRow[]>(quizId);
  }

  async syncQuizzes(request: SyncRequest): Promise<QuizWithDataUrl[] | void> {
    const service = new GasFunctionService("_quizGame_syncQuizzes");
    return await service.call<QuizWithDataUrl[] | void>(request);
  }
}
