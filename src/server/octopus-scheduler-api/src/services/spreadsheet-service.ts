interface SpreadsheetData {
  sheetName: string;
  data: any[][];
}

export class SpreadsheetService {
  private spreadsheetId: string | null;

  constructor(spreadsheetId: string | null) {
    this.spreadsheetId = spreadsheetId;
  }

  addSpreadsheetData(spreadsheetData: SpreadsheetData): void {
    if (!this.spreadsheetId) return;
    const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(spreadsheetData.sheetName);
    if (!sheet) return;
    const data = spreadsheetData.data;
    sheet
      .getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length)
      .setValues(data);
  }

  getAllSpreadsheetNames(): string[] {
    if (!this.spreadsheetId) return [];
    const ss = SpreadsheetApp.openById(this.spreadsheetId);
    return ss.getSheets().map((sheet) => sheet.getName());
  }

  getSpreadsheetData(sheetName: string): SpreadsheetData | null {
    if (!this.spreadsheetId) return null;
    const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    return { sheetName, data };
  }

  removeSpreadsheetData(sheetName: string): void {
    if (!this.spreadsheetId) return;
    const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
    }
  }

  updateSpreadsheetData(
    sheetName: string,
    spreadsheetData: SpreadsheetData
  ): void {
    if (!this.spreadsheetId) return;
    const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    sheet.clear();
    if (spreadsheetData.data.length > 0) {
      sheet
        .getRange(
          1,
          1,
          spreadsheetData.data.length,
          spreadsheetData.data[0].length
        )
        .setValues(spreadsheetData.data);
    }
  }
}
