import { GasResponse } from "../../../common/src/gas-types";
import { GoogleFormService } from "../../../common/src/google-form-service";
import { SpreadsheetService } from "../../../common/src/google-spreadsheet-service";
import type { SheetRow } from "../../../../client/packages/common-lib/src/quiz-types";

declare let _quizGame_stopForm: (quizId: string) => GasResponse<void>;
declare let _quizGame_getSheetData: (quizId: string) => GasResponse<SheetRow[]>;

_quizGame_stopForm = (quizId: string): GasResponse<void> => {
  try {
    const form = FormApp.openById(quizId);
    form.setAcceptingResponses(false);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getSheetData = (quizId: string): GasResponse<SheetRow[]> => {
  try {
    const googleFormService = new GoogleFormService();
    const spreadsheetId = googleFormService.getDestinationSpreadsheetId(quizId);

    if (!spreadsheetId)
      throw new Error("No destination spreadsheet linked to the form");

    const spreadsheetService = new SpreadsheetService(spreadsheetId);
    const sheetNames = spreadsheetService.getAllSpreadsheetNames();

    if (sheetNames.length === 0)
      throw new Error("No sheets found in the spreadsheet");

    const sheetName = sheetNames[0]; // Use the first sheet
    const spreadsheetData = spreadsheetService.getSpreadsheetData(sheetName);

    if (!spreadsheetData) throw new Error("Failed to get spreadsheet data");

    const rows: SheetRow[] = spreadsheetData.data
      .slice(1)
      .map((row: string[]) => ({
        name: row[0],
        time: parseInt(row[1], 10),
      }));

    return { status: "success", data: rows };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};
