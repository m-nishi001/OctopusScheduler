import { SpreadsheetId } from "./value-object/spreadsheet-id";

export class SpreadSheetInfo {
    static getSpreadSheetId(): SpreadsheetId {
        const spreadSheetId = PropertiesService.getScriptProperties().getProperty("spreadsheet-id") || "";
        return SpreadsheetId.create(spreadSheetId)!; // nullになることはあり得ない（ようにする必要がある）
    }
}