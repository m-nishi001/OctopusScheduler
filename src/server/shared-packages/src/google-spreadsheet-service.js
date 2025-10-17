class Serializer {
    static deepDeserialize(value) {
        if (typeof value === "string") {
            if (value.startsWith("{") || value.startsWith("[")) {
                try {
                    const parsed = JSON.parse(value);
                    return Serializer.deepDeserialize(parsed);
                }
                catch { }
            }
            if (!isNaN(new Date(value).getTime())) {
                return new Date(value);
            }
            if (value === "null") {
                return null;
            }
            return value;
        }
        else if (Array.isArray(value)) {
            return value.map((v) => Serializer.deepDeserialize(v));
        }
        else if (typeof value === "object" && value !== null) {
            const obj = {};
            for (const key in value) {
                obj[key] = Serializer.deepDeserialize(value[key]);
            }
            return obj;
        }
        return value;
    }
    static deepSerialize(value) {
        if (value === null) {
            return "null";
        }
        else if (value instanceof Date) {
            return value.toISOString();
        }
        else if (Array.isArray(value)) {
            return JSON.stringify(value.map((v) => Serializer.deepSerialize(v)));
        }
        else if (typeof value === "object" && value !== null) {
            const obj = {};
            for (const key in value) {
                obj[key] = Serializer.deepSerialize(value[key]);
            }
            return JSON.stringify(obj);
        }
        return value;
    }
}
class LockManager {
    static tryLock(timeoutSeconds = 5) {
        const lock = LockService.getScriptLock();
        return lock.tryLock(timeoutSeconds * 1000) ? lock : null;
    }
}
export class Transaction {
    constructor(sheetName, service, spreadsheetIdKey) {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "sheetName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "service", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "spreadsheetIdKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "committed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.sheetName = sheetName;
        this.service = service;
        this.spreadsheetIdKey = spreadsheetIdKey;
        this.loadCache();
    }
    loadCache() {
        try {
            const sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (sheet && sheet.getLastRow() > 1) {
                this.cache = SpreadsheetAccessor.toObjectArray(sheet.getDataRange().getValues());
            }
            else {
                this.cache = [];
            }
        }
        catch (e) {
            console.error("Failed to load cache:", e);
            this.cache = [];
        }
    }
    add(entity) {
        this.cache.push(entity);
        return entity;
    }
    addMany(entities) {
        this.cache.push(...entities);
        return entities;
    }
    update(predicate, updateEntity) {
        let updatedCount = 0;
        for (let i = 0; i < this.cache.length; i++) {
            if (predicate(this.cache[i])) {
                this.cache[i] = updateEntity(this.cache[i]);
                updatedCount++;
            }
        }
        return updatedCount;
    }
    updateMany(ids, updateEntity) {
        let updatedCount = 0;
        for (let i = 0; i < this.cache.length; i++) {
            const entity = this.cache[i];
            if (ids.includes(entity.id)) {
                this.cache[i] = updateEntity(this.cache[i]);
                updatedCount++;
            }
        }
        return updatedCount;
    }
    delete(predicate) {
        const initialLength = this.cache.length;
        this.cache = this.cache.filter((entity) => !predicate(entity));
        return initialLength - this.cache.length;
    }
    deleteMany(ids) {
        const initialLength = this.cache.length;
        this.cache = this.cache.filter((entity) => !ids.includes(entity.id));
        return initialLength - this.cache.length;
    }
    find(predicate) {
        return this.cache.filter(predicate);
    }
    findOne(predicate) {
        const results = this.find(predicate);
        return results.length > 0 ? results[0] : null;
    }
    commit() {
        if (this.committed)
            throw new Error("Transaction already committed.");
        const lock = LockManager.tryLock();
        if (!lock)
            throw new Error("Failed to acquire lock for commit.");
        try {
            let sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (this.cache.length > 0) {
                sheet = SpreadsheetAccessor.createSheet(this.sheetName, Object.keys(this.cache[0]), this.spreadsheetIdKey);
            }
            if (sheet) {
                sheet.clearContents();
                if (this.cache.length > 0) {
                    const header = Object.keys(this.cache[0]);
                    const rows = [
                        header,
                        ...this.cache.map((entity) => SpreadsheetAccessor.toRowArray(entity)),
                    ];
                    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
                }
            }
            this.committed = true;
        }
        finally {
            lock.releaseLock();
        }
    }
}
class SpreadsheetAccessor {
    static getSpreadsheetId(spreadsheetIdKey) {
        const id = PropertiesService.getScriptProperties().getProperty(spreadsheetIdKey) ||
            "";
        if (!id)
            throw new Error(`Spreadsheet ID not found in script properties for key: ${spreadsheetIdKey}.`);
        return id;
    }
    static getSpreadsheet(spreadsheetIdKey) {
        return SpreadsheetApp.openById(this.getSpreadsheetId(spreadsheetIdKey));
    }
    static getSheet(name, spreadsheetIdKey) {
        return this.getSpreadsheet(spreadsheetIdKey).getSheetByName(name);
    }
    static createSheet(name, columns, spreadsheetIdKey) {
        const ss = this.getSpreadsheet(spreadsheetIdKey);
        let sheet = ss.getSheetByName(name);
        if (sheet)
            return sheet;
        sheet = ss.insertSheet(name, ss.getNumSheets());
        sheet.appendRow(columns);
        return sheet;
    }
    static toObjectArray(data) {
        if (data.length === 0)
            return [];
        const header = data[0];
        return data.slice(1).map((record) => {
            const obj = {};
            for (let i = 0; i < header.length; i++) {
                obj[header[i]] = Serializer.deepDeserialize(record[i]);
            }
            return obj;
        });
    }
    static toRowArray(entity) {
        return Object.values(entity).map((value) => Serializer.deepSerialize(value));
    }
}
export class SpreadsheetService {
    constructor(sheetName, spreadsheetIdKey) {
        Object.defineProperty(this, "sheetName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "spreadsheetIdKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.sheetName = sheetName;
        this.spreadsheetIdKey = spreadsheetIdKey;
    }
    static getService(sheetName, spreadsheetIdKey) {
        return new SpreadsheetService(sheetName, spreadsheetIdKey);
    }
    beginTransaction() {
        return new Transaction(this.sheetName, this, this.spreadsheetIdKey);
    }
    add(entity) {
        const lock = LockManager.tryLock();
        if (!lock)
            throw new Error("Failed to acquire lock for add operation.");
        try {
            let sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (!sheet)
                sheet = SpreadsheetAccessor.createSheet(this.sheetName, Object.keys(entity), this.spreadsheetIdKey);
            sheet.appendRow(SpreadsheetAccessor.toRowArray(entity));
            return entity;
        }
        finally {
            lock.releaseLock();
        }
    }
    update(predicate, updateEntity) {
        const lock = LockManager.tryLock();
        if (!lock)
            throw new Error("Failed to acquire lock for update operation.");
        try {
            const sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (!sheet)
                return 0;
            const values = sheet.getDataRange().getValues();
            if (values.length <= 1)
                return 0;
            const header = values[0];
            let updatedCount = 0;
            const updatedRows = [];
            for (let i = 1; i < values.length; i++) {
                const record = {};
                for (let j = 0; j < header.length; j++) {
                    record[header[j]] = values[i][j];
                }
                if (predicate(record)) {
                    const updated = updateEntity(record);
                    updatedRows.push(SpreadsheetAccessor.toRowArray(updated));
                    updatedCount++;
                }
                else {
                    updatedRows.push(values[i]);
                }
            }
            if (updatedCount > 0) {
                sheet
                    .getRange(2, 1, updatedRows.length, header.length)
                    .setValues(updatedRows);
            }
            return updatedCount;
        }
        finally {
            lock.releaseLock();
        }
    }
    delete(predicate) {
        const lock = LockManager.tryLock();
        if (!lock)
            throw new Error("Failed to acquire lock for delete operation.");
        try {
            const sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (!sheet || sheet.getLastRow() <= 1)
                return 0;
            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();
            const header = values.shift();
            const records = SpreadsheetAccessor.toObjectArray([
                header,
                ...values,
            ]);
            const remainingRecords = records.filter((record) => !predicate(record));
            const deletedCount = records.length - remainingRecords.length;
            sheet.clearContents();
            if (remainingRecords.length > 0) {
                const updatedValues = [
                    header,
                    ...remainingRecords.map((record) => SpreadsheetAccessor.toRowArray(record)),
                ];
                sheet
                    .getRange(1, 1, updatedValues.length, updatedValues[0].length)
                    .setValues(updatedValues);
            }
            else {
                sheet.getRange(1, 1, 1, header.length).setValues([header]);
            }
            return deletedCount;
        }
        finally {
            lock.releaseLock();
        }
    }
    find(predicate) {
        const lock = LockManager.tryLock();
        if (!lock)
            throw new Error("Failed to acquire lock for find operation.");
        try {
            const sheet = SpreadsheetAccessor.getSheet(this.sheetName, this.spreadsheetIdKey);
            if (!sheet || sheet.getLastRow() <= 1)
                return [];
            const records = SpreadsheetAccessor.toObjectArray(sheet.getDataRange().getValues());
            return records.filter(predicate);
        }
        finally {
            lock.releaseLock();
        }
    }
    findOne(predicate) {
        const results = this.find(predicate);
        return results.length > 0 ? results[0] : null;
    }
}
