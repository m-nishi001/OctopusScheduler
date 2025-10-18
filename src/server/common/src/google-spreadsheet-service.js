export class SpreadsheetService {
    constructor(spreadsheetId) {
        Object.defineProperty(this, "spreadsheetId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.spreadsheetId = spreadsheetId;
    }
    upsertSpreadsheetData(spreadsheetData) {
        if (!this.spreadsheetId)
            return;
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        let sheet = spreadsheet.getSheetByName(spreadsheetData.sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(spreadsheetData.sheetName);
        }
        sheet.clear();
        const data = spreadsheetData.data;
        if (data.length > 0) {
            sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
        }
    }
    getAllSpreadsheetNames() {
        if (!this.spreadsheetId)
            return [];
        const ss = SpreadsheetApp.openById(this.spreadsheetId);
        return ss.getSheets().map((sheet) => sheet.getName());
    }
    getSpreadsheetData(sheetName) {
        if (!this.spreadsheetId)
            return null;
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet)
            return null;
        const data = sheet.getDataRange().getValues();
        return { sheetName, data };
    }
    removeSpreadsheetData(sheetName) {
        if (!this.spreadsheetId)
            return;
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (sheet) {
            spreadsheet.deleteSheet(sheet);
        }
    }
}
