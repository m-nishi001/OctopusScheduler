import { GasFunctionService } from "packages/common-lib/google-apps-script/gas-script-service";

interface SheetRow {
  name: string;
  time: number;
}

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
