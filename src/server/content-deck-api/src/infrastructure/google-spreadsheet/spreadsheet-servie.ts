import { injectable } from "tsyringe";
import { IRepository } from "../../repository/repository";
import { SpreadSheetInfo } from "./spreadsheet-info";
import { ColumnDefinition } from "./value-object/column-definition";
import { SpreadsheetLock } from "./value-object/spreadsheet-lock";

@injectable()
export class SpreadsheetService implements IRepository {
    insert(sheetName: string, records: any[]): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return -1;

        Logger.log(`[SpreadsheetService.insert] inserting values to ${sheetName}...`);
        const columnDefinitions = this.getColumnDefinitions(records[0]);
        const sheet = this.createSheet(sheetName, columnDefinitions);

        Logger.log(`[SpreadsheetService.insert] lastRecordRowNumber: ${sheet.getLastRow() - 1} columnNum: ${columnDefinitions.length} insertingRecordNum: ${records.length}`)

        const lastRow = sheet.getLastRow();
        if (sheet.getMaxRows() === lastRow) sheet.insertRows(lastRow, records.length);

        const range = sheet.getRange(
            sheet.getLastRow() + 1, // 最終行 + 1
            1,
            records.length, // 追加行数
            columnDefinitions.length
        );
        const values = records.map(row => Object.values(row));
        range.setNumberFormat("@").setValues(values);

        Logger.log(`[SpreadsheetService.insert] completed inserting values.`);

        return records.length;
    }

    select(sheetName: string, predicate: (record: any) => boolean): any[] | null {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return null;

        Logger.log(`[SpreadsheetService.select] selecting values in the sheet name of ${sheetName}...`);
        const sheet = this.getSheet(sheetName);
        if (!sheet) return null;

        if (sheet.getLastRow() === 1) return null;

        const range = sheet.getDataRange();
        const founds = this.toObjectArray(range.getValues()).filter(predicate).slice(1);
        Logger.log(`[SpreadsheetService.select] completed selecting values in the sheet name of ${sheetName}. founds: ${JSON.stringify(founds)}`);

        return founds;
    }

    update(sheetName: string, predicate: (record: any) => boolean, execution: (record: any) => any): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return -1;

        Logger.log(`[SpreadsheetService.update] updating values in the sheet name of ${sheetName}...`);
        const sheet = this.getSheet(sheetName);
        if (!sheet) return -1;

        if (sheet.getLastRow() === 1) return 0;

        const range = sheet.getDataRange();
        const records = this.toObjectArray(range.getValues());
        let targetNum = 0;
        const updatedRecords = records
            .map((record, index) => {
                if (index !== 0 && predicate(record)) {
                    targetNum++;
                    return execution(record);
                } else {
                    return record
                }
            })
            .map((updatedRecord, index) => index === 0 ? Object.keys(updatedRecord) : Object.values(updatedRecord));

        Logger.log(`[SpreadsheetService.update] updatedRecords: ${JSON.stringify(updatedRecords)}`);

        range.setNumberFormat("@").setValues(updatedRecords);

        Logger.log(`[SpreadsheetService.update] completed updating values in the sheet name of ${sheetName}.`);
        return targetNum;
    }

    delete(sheetName: string, predicate: (record: any) => boolean): number {
        using lock = SpreadsheetLock.tryLock();
        if (!lock) return 0;

        Logger.log(`[SpreadsheetService.delete] deleting values in the sheet name of ${sheetName}...`);
        const sheet = this.getSheet(sheetName);
        if (!sheet) return 0;

        if (sheet.getLastRow() === 1) return 0;

        const range = sheet.getDataRange();
        const rows = this.toObjectArray(range.getValues());
        const filtered = rows
            .filter((row, index) => index === 0 || !predicate(row))
            .map((row, index) => index === 0 ? Object.keys(row) : Object.values(row));

        const diff = rows.length - filtered.length;
        if (diff > 0) {
            const columnNum = range.getNumColumns();
            for (let i = 1; i <= diff; i++)
                filtered.push(new Array(columnNum));

            range.setNumberFormat("@").setValues(filtered);
            Logger.log(`[SpreadsheetService.delete] completed deleting values in the sheet name of ${sheetName}. delete count is ${diff}`);

            return diff;
        }

        return 0;
    }

    private getSpreadSheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
        const spreadSheetId = SpreadSheetInfo.getSpreadSheetId();
        return SpreadsheetApp.openById(spreadSheetId.id);
    }

    private getSheet(
        sheetName: string,
        spreadSheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null): GoogleAppsScript.Spreadsheet.Sheet | null {
        const sheet = (spreadSheet ?? this.getSpreadSheet()).getSheetByName(sheetName);
        if (sheet) {
            Logger.log(`[SpreadsheetService.createSheet] found the sheet name of ${sheetName}`);
            return sheet;
        }

        Logger.log(`[SpreadsheetService.createSheet] not found the sheett name of ${sheetName}`);
        return null;
    }

    private getColumnDefinitions(entity: any): ColumnDefinition[] {
        const definitions = Object.keys(entity).map(key => ColumnDefinition.create(key));
        if (definitions.some(definition => !definition)) throw new Error();
        return definitions as ColumnDefinition[];
    }

    private createSheet(
        sheetName: string,
        columnDefinitions: ColumnDefinition[]
    ): GoogleAppsScript.Spreadsheet.Sheet {
        const sheet = this.getSheet(sheetName);
        if (sheet) return sheet;

        const spreadSheet = this.getSpreadSheet();

        Logger.log(`[SpreadsheetService.createSheet] creating new sheet name of ${sheetName} ...`);
        const newSheet = spreadSheet.insertSheet(sheetName, spreadSheet.getNumSheets());
        Logger.log(`[SpreadsheetService.createSheeet] the sheet name of ${sheetName} was created.`);

        Logger.log(`[SpreadsheetService.createSheet] adding the header row...`);
        newSheet.appendRow(columnDefinitions.map(definition => definition.colmunName));
        Logger.log(`[SpreadsheetService.createSheet] added the header row.`);

        return newSheet;
    }

    private toObjectArray(data: any[][]): any[] {
        const header = data[0];
        const array = data.map((record, rowIndex) => record.reduce(
            (previous, current, columnIndex) => {
                const columnName = header[columnIndex];
                Logger.log(`[SpreadsheetService.toObjectArray] rowIndex: ${rowIndex} columnIndex: ${columnIndex} current: ${current}`);
                previous[columnName] = rowIndex === 0 ? "" : current;
                return previous;
            }, {}));
        Logger.log(`[SpreadsheetService.toObjectArray] array: ${JSON.stringify(array)}`);
        return array;
    }
}