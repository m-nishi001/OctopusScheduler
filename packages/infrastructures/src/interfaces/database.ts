/**
 * 表形式データストアの抽象化(GASでは Spreadsheet)。
 *
 * 1インスタンスが1つの保存先(GASでは1つのスプレッドシートID)に束縛される。
 * 保存先IDが未設定の場合、GAS実装は全メソッドを no-op/空返しにする(既存挙動を保持)。
 *
 * ユーザーが外部UI(Google Sheets)で直接編集するデータを読むための契約であり、
 * IKeyValueStorage とは形が異なる(アプリが所有するキー付きデータではない)ため、
 * 別の契約として分けている。実際に呼び出される listCollections/getCollection の
 * みを持ち、他のメソッドは呼び出し実績が出るまで追加しない。
 */
export interface DataCollection {
  name: string;
  rows: unknown[][];
}

export interface IDataBase {
  listCollections(): string[];
  getCollection(name: string): DataCollection | null;
}

/** 保存先ID(GASではスプレッドシートID)から IDataBase を作るファクトリ。 */
export type DataBaseFactory = (dataBaseId: string | null) => IDataBase;

export const DataBaseFactoryToken = Symbol("DataBaseFactory");
