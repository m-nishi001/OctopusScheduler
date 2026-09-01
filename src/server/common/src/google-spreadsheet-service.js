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
    // Append rows to the sheet; create sheet if missing
    appendRows(sheetName, rows) {
        if (!this.spreadsheetId)
            return;
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
        }
        if (rows.length === 0)
            return;
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    // Find row indices by id (id is in column index 1-based idColumnIndex)
    findRowIndexById(sheetName, idColumnIndex = 1) {
        const result = new Map();
        if (!this.spreadsheetId)
            return result;
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet)
            return result;
        const data = sheet.getDataRange().getValues();
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const id = String(row[idColumnIndex - 1] ?? "");
            if (id !== "") {
                result.set(id, i + 1); // 1-based row index
            }
        }
        return result;
    }
    // Update rows by id; rowsMap maps id -> row array (full row to set starting column 1)
    updateRowsById(sheetName, rowsMap, idColumnIndex = 1) {
        const missing = [];
        let updated = 0;
        if (!this.spreadsheetId)
            return { updated, missingIds: Array.from(missing) };
        const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            // create sheet and append all rows since none exist
            sheet = spreadsheet.insertSheet(sheetName);
            const rows = [];
            for (const row of rowsMap.values()) {
                rows.push(row);
            }
            if (rows.length > 0) {
                sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
                updated = rows.length;
            }
            return { updated, missingIds: [] };
        }
        const idIndex = idColumnIndex - 1;
        const data = sheet.getDataRange().getValues();
        const lastCol = data[0] ? data[0].length : 0;
        for (const [id, row] of rowsMap.entries()) {
            let foundRowIndex = -1;
            for (let i = 0; i < data.length; i++) {
                const r = data[i];
                if (String(r[idIndex] ?? "") === id) {
                    foundRowIndex = i + 1; // 1-based
                    break;
                }
            }
            if (foundRowIndex === -1) {
                missing.push(id);
                continue;
            }
            // Ensure row has at least lastCol columns
            const padded = row.slice();
            while (padded.length < lastCol)
                padded.push("");
            sheet.getRange(foundRowIndex, 1, 1, padded.length).setValues([padded]);
            updated++;
        }
        return { updated, missingIds: missing };
    }
}
