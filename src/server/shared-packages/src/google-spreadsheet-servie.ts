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
        return data
            .slice(1)
            .map(record => {
                const obj: any = {};
                for (let i = 0; i < header.length; i++) {
                    obj[header[i]] = SpreadsheetHelper.deepDeserialize(record[i]);
                }
                return obj;
            });
    }

    static toRowArray(entity: any): any[] {
        return Object.values(entity).map(value => SpreadsheetHelper.deepSerialize(value));
    }

    private static deepDeserialize(value: any): any {
        if (typeof value === 'string') {
            // JSON文字列か判定
            if (value.startsWith('{') || value.startsWith('[')) {
                try {
                    const parsed = JSON.parse(value);
                    return SpreadsheetHelper.deepDeserialize(parsed);
                } catch {
                    // パース失敗時はそのまま返す
                }
            }
            // 日付文字列か判定
            if (!isNaN(new Date(value).getTime())) {
                return new Date(value);
            }
            return value;
        } else if (Array.isArray(value)) {
            return value.map(v => SpreadsheetHelper.deepDeserialize(v));
        } else if (typeof value === 'object' && value !== null) {
            const obj: any = {};
            for (const key in value) {
                obj[key] = SpreadsheetHelper.deepDeserialize(value[key]);
            }
            return obj;
        }
        return value;
    }

    private static deepSerialize(value: any): any {
        if (value instanceof Date) {
            return value.toISOString();
        } else if (Array.isArray(value)) {
            return JSON.stringify(value.map(v => SpreadsheetHelper.deepSerialize(v)));
        } else if (typeof value === 'object' && value !== null) {
            // オブジェクトの場合は各プロパティを再帰的にシリアライズ
            const obj: any = {};
            for (const key in value) {
                obj[key] = SpreadsheetHelper.deepSerialize(value[key]);
            }
            return JSON.stringify(obj);
        }
        return value;
    }
}

export class SpreadsheetService<T> implements ISpreadsheetService<T> {
    private readonly sheetName: string;

    private constructor(sheetName: string) {
        this.sheetName = sheetName;
    }

    static getService<T>(sheetName: string): ISpreadsheetService<T> {
        return new SpreadsheetService<T>(sheetName);
    }

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

export interface ISpreadsheetService<T> {
    add(entity: T): T;
    update(predicate: (entity: T) => boolean, updateEntity: (entity: T) => T): number;
    delete(predicate: (entity: T) => boolean): boolean;
    find(predicate: (entity: T) => boolean): T[];
    findOne(predicate: (entity: T) => boolean): T | null;
}