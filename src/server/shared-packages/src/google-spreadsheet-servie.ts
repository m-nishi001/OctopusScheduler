class SpreadsheetHelper {
    static getSpreadsheetId(): string {
        const id = PropertiesService.getScriptProperties().getProperty("spreadsheet-id") || "";
        if (!id) throw new Error("Spreadsheet ID not found in script properties.");
        return id;
    }

    static getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
        return SpreadsheetApp.openById(this.getSpreadsheetId());
    }

    static getSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet | null {
        return this.getSpreadsheet().getSheetByName(name);
    }

    static createSheet(name: string, columns: string[]): GoogleAppsScript.Spreadsheet.Sheet {
        const ss = this.getSpreadsheet();
        let sheet = ss.getSheetByName(name);
        if (sheet) return sheet;
        sheet = ss.insertSheet(name, ss.getNumSheets());
        sheet.appendRow(columns);
        return sheet;
    }

    static tryLock(timeoutSeconds: number = 5): GoogleAppsScript.Lock.Lock | null {
        const lock = LockService.getScriptLock();
        return lock.tryLock(timeoutSeconds * 1000) ? lock : null;
    }

    static toObjectArray(data: any[][]): any[] {
        if (data.length === 0) return [];
        const header = data[0];
        return data.slice(1).map(record => {
            const obj: any = {};
            for (let i = 0; i < header.length; i++) {
                const val = record[i];
                obj[header[i]] = (typeof val === 'string' && val.startsWith('{')) ? JSON.parse(val) : val;
            }
            return obj;
        });
    }

    static toRowArray(entity: any): any[] {
        return Object.values(entity).map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    }
}

class DataStoreRepository<T> implements IRepository<T> {

    constructor(private readonly sheetName: string) { }

    add(entity: T): T {
        const lock = SpreadsheetHelper.tryLock();
        if (!lock) throw new Error("Failed to acquire lock for add operation.");
        try {
            let sheet = SpreadsheetHelper.getSheet(this.sheetName);
            if (!sheet) sheet = SpreadsheetHelper.createSheet(this.sheetName, Object.keys(entity as object));
            sheet.appendRow(SpreadsheetHelper.toRowArray(entity));
            return entity;
        } finally {
            lock.releaseLock();
        }
    }

    update(predicate: (entity: T) => boolean, updateEntity: (entity: T) => T): number {
        const lock = SpreadsheetHelper.tryLock();
        if (!lock) throw new Error("Failed to acquire lock for update operation.");
        try {
            const sheet = SpreadsheetHelper.getSheet(this.sheetName);
            if (!sheet) return 0;
            const values = sheet.getDataRange().getValues();
            if (values.length <= 1) return 0;
            const header = values[0];
            let updatedCount = 0;
            const updatedRows: any[][] = [];
            for (let i = 1; i < values.length; i++) {
                const record: any = {};
                for (let j = 0; j < header.length; j++) {
                    record[header[j]] = values[i][j];
                }
                if (predicate(record)) {
                    const updated = updateEntity(record);
                    updatedRows.push(SpreadsheetHelper.toRowArray(updated));
                    updatedCount++;
                } else {
                    updatedRows.push(values[i]);
                }
            }
            // バッチで一括更新
            if (updatedCount > 0) {
                sheet.getRange(2, 1, updatedRows.length, header.length).setValues(updatedRows);
            }
            return updatedCount;
        } finally {
            lock.releaseLock();
        }
    }

    find(predicate: (entity: T) => boolean): T[] {
        const lock = SpreadsheetHelper.tryLock();
        if (!lock) throw new Error("Failed to acquire lock for find operation.");
        try {
            const sheet = SpreadsheetHelper.getSheet(this.sheetName);
            if (!sheet || sheet.getLastRow() <= 1) return [];
            const records = SpreadsheetHelper.toObjectArray(sheet.getDataRange().getValues()) as T[];
            return records.filter(predicate);
        } finally {
            lock.releaseLock();
        }
    }

    findOne(predicate: (entity: T) => boolean): T | null {
        const results = this.find(predicate);
        return results.length > 0 ? results[0] : null;
    }

    delete(predicate: (entity: T) => boolean): boolean {
        const lock = SpreadsheetHelper.tryLock();
        if (!lock) throw new Error("Failed to acquire lock for delete operation.");
        try {
            const sheet = SpreadsheetHelper.getSheet(this.sheetName);
            if (!sheet || sheet.getLastRow() <= 1) return false;
            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();
            const header = values.shift()!;
            const records = SpreadsheetHelper.toObjectArray([header, ...values]) as T[];
            const remainingRecords = records.filter(record => !predicate(record));
            sheet.clearContents();
            if (remainingRecords.length > 0) {
                const updatedValues = [header, ...remainingRecords.map(record => SpreadsheetHelper.toRowArray(record))];
                sheet.getRange(1, 1, updatedValues.length, updatedValues[0].length).setValues(updatedValues);
            } else {
                sheet.getRange(1, 1, 1, header.length).setValues([header]);
            }
            return records.length !== remainingRecords.length;
        } finally {
            lock.releaseLock();
        }
    }
}

export interface IRepository<T> {
    add(entity: T): T;
    update(predicate: (entity: T) => boolean, updateEntity: (entity: T) => T): number;
    delete(predicate: (entity: T) => boolean): boolean;
    find(predicate: (entity: T) => boolean): T[];
    findOne(predicate: (entity: T) => boolean): T | null;
}

export class DataAccessService {
    public static getRepository<T>(sheetName: string): IRepository<T> {
        return new DataStoreRepository<T>(sheetName);
    }
}
