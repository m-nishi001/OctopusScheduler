import { GasResponse } from "../../../common/src/gas-types";
import { GoogleFormService } from "../../../common/src/google-form-service";
import { SpreadsheetService } from "../../../common/src/google-spreadsheet-service";
import type {
  SheetRow,
  QuizWithDataUrl,
  SyncRequest,
} from "./quiz-game-api.d.ts";

declare let _quizGame_stopForm: (quizId: string) => GasResponse<void>;
declare let _quizGame_getSheetData: (quizId: string) => GasResponse<SheetRow[]>;
declare let _quizGame_syncQuizzes: (
  request: SyncRequest
) => GasResponse<QuizWithDataUrl[] | void>;

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

_quizGame_syncQuizzes = (
  request: SyncRequest
): GasResponse<QuizWithDataUrl[] | void> => {
  try {
    const properties = PropertiesService.getScriptProperties();
    const folderId = properties.getProperty("quiz-game-asset-folder");
    if (!folderId)
      throw new Error("quiz-game-asset-folder not set in ScriptProperties");

    const folder = DriveApp.getFolderById(folderId);

    if (request.direction === "gas-to-local") {
      const quizzesJson = properties.getProperty("quizzes");
      const quizzes: QuizWithDataUrl[] = quizzesJson
        ? JSON.parse(quizzesJson)
        : [];
      return { status: "success", data: quizzes };
    } else if (request.direction === "local-to-gas") {
      const quizzes = request.quizzes!;
      // Delete existing files in folder
      const files = folder.getFiles();
      while (files.hasNext()) {
        files.next().setTrashed(true);
      }
      // Save new quizzes
      properties.setProperty("quizzes", JSON.stringify(quizzes));
      // Save blobs to Drive
      for (const quiz of quizzes) {
        if (quiz.bgm) {
          const blob = dataUrlToBlob(quiz.bgm);
          folder.createFile(`${quiz.id}_bgm`, blob as any);
        }
        quiz.options.forEach((option, index) => {
          if (option.image) {
            const blob = dataUrlToBlob(option.image);
            folder.createFile(`${quiz.id}_option_${index}`, blob as any);
          }
        });
      }
      return { status: "success", data: undefined };
    }
    throw new Error("Invalid direction");
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

function dataUrlToBlob(dataUrl: string): GoogleAppsScript.Base.Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  const numArr = Array.from(u8arr);
  return Utilities.newBlob(numArr, mime);
}
