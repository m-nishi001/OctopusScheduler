import type { DataBaseFactory } from "@octopus/infrastructures/interfaces";
import type { SheetRow } from "./quiz-api-contract";

export interface GetSheetDataDeps {
  form: { getDestinationRecordStoreId(formId: string): string | null };
  dataBaseFactory: DataBaseFactory;
}

export function getSheetData(deps: GetSheetDataDeps, quizId: string): SheetRow[] {
  const spreadsheetId = deps.form.getDestinationRecordStoreId(quizId);
  if (!spreadsheetId) {
    throw new Error("No destination spreadsheet linked to the form");
  }

  const dataBase = deps.dataBaseFactory(spreadsheetId);
  const sheetNames = dataBase.listCollections();
  if (sheetNames.length === 0) {
    throw new Error("No sheets found in the spreadsheet");
  }

  const collection = dataBase.getCollection(sheetNames[0]);
  if (!collection) {
    throw new Error("Failed to get spreadsheet data");
  }

  return collection.rows.slice(1).map((row) => ({
    name: row[0] as string,
    time: parseInt(String(row[1]), 10),
  }));
}
