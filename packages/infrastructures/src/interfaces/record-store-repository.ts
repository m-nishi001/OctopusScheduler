/**
 * 表形式データストアの抽象化(GASでは Spreadsheet)。
 *
 * 1インスタンスが1つの保存先(GASでは1つのスプレッドシートID)に束縛される。
 * 保存先IDが未設定の場合、GAS実装は全メソッドを no-op/空返しにする(既存挙動を保持)。
 */
export interface IRecordStoreRepository {
  listCollections(): string[];
  replaceCollection(name: string, rows: unknown[][]): void;
  getCollection(name: string): { name: string; rows: unknown[][] } | null;
  deleteCollection(name: string): void;
  appendRows(name: string, rows: unknown[][]): void;

  /** id列(1始まり、既定1)を見て、各行の値 -> 1始まり行番号 のMapを返す。 */
  findRowIndexById(name: string, idColumnIndex?: number): Map<string, number>;

  /** id -> 行データ のMapを使って、id列が一致する行を更新する。無ければ作成する。 */
  updateRowsById(
    name: string,
    rowsById: Map<string, unknown[]>,
    idColumnIndex?: number
  ): { updated: number; missingIds: string[] };
}

/** 保存先ID(GASではスプレッドシートID)から IRecordStoreRepository を作るファクトリ。 */
export type RecordStoreRepositoryFactory = (
  recordStoreId: string | null
) => IRecordStoreRepository;

export const RecordStoreRepositoryFactoryToken = Symbol(
  "RecordStoreRepositoryFactory"
);
