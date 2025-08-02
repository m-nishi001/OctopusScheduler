import { ColumnDefinition } from "./column-definition";
import { SpreadSheetId } from "./spreadsheet-id";
import { SpreadSheetName } from "./spreadsheet-name";

export class SpreadSheetDto<IEntity> {
    spreadSheetId: SpreadSheetId;
    spreadSheetName: SpreadSheetName;
    columns: ColumnDefinition[];
    rows: IEntity[]

    private constructor(
        spreadSheetId: SpreadSheetId,
        sheetName: SpreadSheetName,
        columns: ColumnDefinition[],
        rows: IEntity[]) {
        this.spreadSheetId = spreadSheetId;
        this.spreadSheetName = sheetName;
        this.columns = columns;
        this.rows = rows;
    }

    static create<IEntity>(
        spreadSheetId: SpreadSheetId,
        sheetName: SpreadSheetName,
        columns: ColumnDefinition[],
        rows: IEntity[]): SpreadSheetDto<IEntity> | null {
        const keyColumnNum = columns.filter(column => column.isKey).length;
        if (keyColumnNum > 1 || keyColumnNum === 0) {
            Logger.log(`[Entity.create] key column num is ${keyColumnNum}`);
            return null;
        }

        return new SpreadSheetDto<IEntity>(spreadSheetId, sheetName, columns, rows);
    }
}