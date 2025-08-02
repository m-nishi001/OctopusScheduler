import { ColumnDefinition } from "./value-object/column-definition";
import { SpreadSheetDto } from "./value-object/spreadsheet-dto";
import { SpreadSheetId } from "./value-object/spreadsheet-id";
import { SpreadsheetLock } from "./value-object/spreadsheet-lock";
import { SpreadSheetName } from "./value-object/spreadsheet-name";
import { SpreadSheetQuery } from "./value-object/spreadsheet-query";

export class GooogleSpreadSheetService {

    static insert<IEntity>(dto: SpreadSheetDto<IEntity>): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return -1;

        Logger.log(`[SpreadSheetService.insert] inserting values to ${dto.spreadSheetName}...`);
        const sheet = this.createSheet(dto.spreadSheetId, dto.spreadSheetName, dto.columns);
        const exitsRecordsNum = sheet.getLastRow() - 1;
        const insertingIndex = 1 /* ヘッダー行 */ + exitsRecordsNum + 1;
        const columnNum = dto.columns.length;
        const insertingRecordNum = dto.rows.length;

        Logger.log(`[SpreadSheetService.insert] lastRecordRowNumber: ${exitsRecordsNum} columnNum: ${columnNum} insertingRecordNum: ${insertingRecordNum}`)
        const range = sheet.getRange(insertingIndex, 1, insertingRecordNum, columnNum);
        const values = dto.rows.map(row => dto.columns.map(column => (row as any)[column.colmunName]));
        range.setNumberFormat("@").setValues(values);

        Logger.log(`[SpreadSheetService.insert] completed inserting values.`);

        return dto.rows.length;
    }

    static select<TEntity>(query: SpreadSheetQuery<TEntity>): TEntity[] | null {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return null;

        Logger.log(`[SpreadSheetService.select] selecting values in the sheet name of ${query.spreadSheetName.name}...`);
        const sheet = this.getSheet(query.spreadSheetId, query.spreadSheetName);
        if (!sheet) return null;

        if (sheet.getLastRow() === 1) {
            Logger.log(`[SpreadSheetService.select] the sheet name of ${query.spreadSheetName.name} has no data.`);
            return null;
        }

        const rowNum = sheet.getLastRow();
        const columnNum = sheet.getLastColumn();
        Logger.log(`[SpreadSheetService.select] rowNum: ${rowNum} columnNum: ${columnNum}`);

        const range = sheet.getRange(1, 1, rowNum, columnNum);
        const rows = range.getValues();
        const founds = this.toObjectArray(rows).filter(record => query.prediction(record));
        Logger.log(`[SpreadSheetService.select] completed selecting values in the sheet name of ${query.spreadSheetName.name}.`);

        return founds;
    }

    static update<TEntity>(dto: SpreadSheetDto<TEntity>): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return -1;

        Logger.log(`[SpreadSheetService.update] updating values in the sheet name of ${dto.spreadSheetName.name}...`);
        const sheet = this.createSheet(dto.spreadSheetId, dto.spreadSheetName, dto.columns);

        if (sheet.getLastRow() === 1) {
            Logger.log(`[SpreadSheetService.update] the sheet name of ${dto.spreadSheetName.name} has no data.`);
            return 0;
        }

        const recordNum = sheet.getLastRow() - 1;
        const columnNum = dto.columns.length;
        Logger.log(`[SpreadSheetService.update] recordNum: ${recordNum} columnNum: ${columnNum}`);

        const keyColumnName = dto.columns.find(column => column.isKey)!.colmunName;
        const updateTargets = dto.rows.map(row => {
            return {
                keyValue: (row as any)[keyColumnName],
                values: row
            }
        })
        const range = sheet.getRange(2, 1, recordNum, columnNum);
        const rows = range.getValues();
        const updatedRows = rows.map(row => {
            const keyColumnValue = (row as any)[keyColumnName];
            const updateData = updateTargets.find(target => target.keyValue === keyColumnValue);
            if (updateData) return this.deepCopy(updateData.values);

            return this.deepCopy(row);
        });
        range.setNumberFormat("@").setValues(updatedRows);
        Logger.log(`[SpreadSheetService.update] completed updating values in the sheet name of ${dto.spreadSheetName.name}.`);

        return updateTargets.length;
    }

    static delete<TEntity>(query: SpreadSheetQuery<TEntity>): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return 0;

        Logger.log(`[SpreadSheetService.delete] deleting values in the sheet name of ${query.spreadSheetName.name}...`);
        const sheet = this.getSheet(query.spreadSheetId, query.spreadSheetName);
        if (!sheet) return 0;

        if (sheet.getLastRow() === 1) {
            Logger.log(`[SpreadSheetService.delete] the sheet name of ${query.spreadSheetName.name} has no data.`);
            return 0;
        }

        const rowNum = sheet.getLastRow();
        const columnNum = sheet.getLastColumn();
        Logger.log(`[SpreadSheetService.delete] rowNum: ${rowNum} columnNum: ${columnNum}`);

        const range = sheet.getRange(1, 1, rowNum, columnNum);
        const rows = range.getValues();
        const results =
            this.toObjectArray(rows)
                .map(record => query.prediction(record) ? new Array(columnNum) : this.deepCopy(Object.values(record)))
                .sort((a, b) => {
                    if (a.length === 0) return -1;
                    if (a.length !== 0 && b.length === 0) return 1;
                    return 0;
                });
        results.unshift(rows[0]);
        range.setNumberFormat("@").setValues(results);
        const deleteCount = results.filter(result => result.length === 0).length;

        Logger.log(`[SpreadSheetService.delete] completed deleting values in the sheet name of ${query.spreadSheetName.name}. delete count is ${deleteCount}`);

        return deleteCount;
    }

    private static getSpreadSheet(spreadSheetId: SpreadSheetId): GoogleAppsScript.Spreadsheet.Spreadsheet {
        return SpreadsheetApp.openById(spreadSheetId.id);
    }

    private static getSheet(
        spreadSheetId: SpreadSheetId,
        sheetName: SpreadSheetName,
        spreadSheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null): GoogleAppsScript.Spreadsheet.Sheet | null {
        const sheet = (spreadSheet ?? this.getSpreadSheet(spreadSheetId)).getSheetByName(sheetName.name);
        if (sheet) {
            Logger.log(`[SpreadSheetService.createSheet] found the sheet name of ${sheetName.name}`);
            return sheet;
        }

        Logger.log(`[SpreadSheetService.createSheet] not found the sheett name of ${sheetName.name}`);
        return null;
    }

    private static createSheet(
        spreadSheetId: SpreadSheetId,
        sheetName: SpreadSheetName,
        columns: ColumnDefinition[]
    ): GoogleAppsScript.Spreadsheet.Sheet {
        const sheet = this.getSheet(spreadSheetId, sheetName);
        if (sheet) return sheet;

        const spreadSheet = this.getSpreadSheet(spreadSheetId);

        Logger.log(`[SpreadSheetService.createSheet] creating new sheet name of ${sheetName.name} ...`);
        const newSheet = spreadSheet.insertSheet(sheetName.name, spreadSheet.getNumSheets());
        Logger.log(`[SpreadSheetService.createSheeet] the sheet name of ${sheetName.name} was created.`);

        Logger.log(`[SpreadSheetService.createSheet] adding the header row...`);
        newSheet.appendRow(columns.map(column => column.colmunName));
        Logger.log(`[SpreadSheetService.createSheet] added the header row.`);

        return newSheet;
    }

    private static deepCopy(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }

    private static toObjectArray(data: any[][]): any[] {
        const header = data[0];
        const records = data.slice(1);
        return records.map(record => record.reduce(
            (previous, current, index) => {
                const columnName = header[index];
                previous[columnName] = current;
                return previous;
            }, {}));
    }
}