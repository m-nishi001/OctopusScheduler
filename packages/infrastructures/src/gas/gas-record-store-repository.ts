import type {
  IRecordStoreRepository,
  RecordStoreRepositoryFactory,
} from "../interfaces/record-store-repository";

/**
 * IRecordStoreRepository の GAS 実装(Spreadsheet)。
 *
 * tsyringe の DI では解決できない実行時パラメータ(スプレッドシートID)を
 * コンストラクタで受け取るため、`@injectable()` にはせず、
 * `createGasRecordStoreRepository` ファクトリ経由でインスタンス化する。
 */
export class GasRecordStoreRepository implements IRecordStoreRepository {
  constructor(private readonly recordStoreId: string | null) {}

  listCollections(): string[] {
    if (!this.recordStoreId) return [];
    const ss = SpreadsheetApp.openById(this.recordStoreId);
    return ss.getSheets().map((sheet) => sheet.getName());
  }

  replaceCollection(name: string, rows: unknown[][]): void {
    if (!this.recordStoreId) return;
    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }
    sheet.clear();
    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  getCollection(name: string): { name: string; rows: unknown[][] } | null {
    if (!this.recordStoreId) return null;
    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return null;
    return { name, rows: sheet.getDataRange().getValues() };
  }

  deleteCollection(name: string): void {
    if (!this.recordStoreId) return;
    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    const sheet = spreadsheet.getSheetByName(name);
    if (sheet) {
      spreadsheet.deleteSheet(sheet);
    }
  }

  appendRows(name: string, rows: unknown[][]): void {
    if (!this.recordStoreId) return;
    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }
    if (rows.length === 0) return;
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  findRowIndexById(name: string, idColumnIndex = 1): Map<string, number> {
    const result = new Map<string, number>();
    if (!this.recordStoreId) return result;
    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return result;
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const id = String(row[idColumnIndex - 1] ?? "");
      if (id !== "") {
        result.set(id, i + 1);
      }
    }
    return result;
  }

  updateRowsById(
    name: string,
    rowsById: Map<string, unknown[]>,
    idColumnIndex = 1
  ): { updated: number; missingIds: string[] } {
    const missing: string[] = [];
    let updated = 0;
    if (!this.recordStoreId) return { updated, missingIds: missing };

    const spreadsheet = SpreadsheetApp.openById(this.recordStoreId);
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      const rows: unknown[][] = [];
      for (const row of rowsById.values()) {
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

    for (const [id, row] of rowsById.entries()) {
      let foundRowIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][idIndex] ?? "") === id) {
          foundRowIndex = i + 1;
          break;
        }
      }
      if (foundRowIndex === -1) {
        missing.push(id);
        continue;
      }
      const padded = row.slice();
      while (padded.length < lastCol) padded.push("");
      sheet.getRange(foundRowIndex, 1, 1, padded.length).setValues([padded]);
      updated++;
    }

    return { updated, missingIds: missing };
  }
}

export const createGasRecordStoreRepository: RecordStoreRepositoryFactory = (
  recordStoreId: string | null
) => new GasRecordStoreRepository(recordStoreId);
