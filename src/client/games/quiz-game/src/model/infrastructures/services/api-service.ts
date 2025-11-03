import { GasFunctionService } from "packages/common-lib/google-apps-script/gas-script-service";
import type { SheetRow } from "@server/quiz-game-api";

export class ApiService {
  async stopForm(quizId: string): Promise<void> {
    const service = new GasFunctionService("stopForm");
    await service.call<void>(quizId);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const service = new GasFunctionService("getSheetData");
    return await service.call<SheetRow[]>(quizId);
  }
}
