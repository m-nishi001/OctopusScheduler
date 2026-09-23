import type { DataBaseFactory, DataCollection, IDataBase } from "../interfaces/database";

/**
 * IDataBase の GAS 実装(Spreadsheet)。
 *
 * tsyringe の DI では解決できない実行時パラメータ(スプレッドシートID)を
 * コンストラクタで受け取るため、`@injectable()` にはせず、
 * `createGasDataBase` ファクトリ経由でインスタンス化する。
 */
export class GasDataBase implements IDataBase {
  constructor(private readonly dataBaseId: string | null) {}

  listCollections(): string[] {
    if (!this.dataBaseId) return [];
    const ss = SpreadsheetApp.openById(this.dataBaseId);
    return ss.getSheets().map((sheet) => sheet.getName());
  }

  getCollection(name: string): DataCollection | null {
    if (!this.dataBaseId) return null;
    const spreadsheet = SpreadsheetApp.openById(this.dataBaseId);
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return null;
    return { name, rows: sheet.getDataRange().getValues() };
  }
}

export const createGasDataBase: DataBaseFactory = (dataBaseId: string | null) =>
  new GasDataBase(dataBaseId);
