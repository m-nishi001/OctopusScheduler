class Serializer {
  static deepDeserialize(value: any): any {
    if (typeof value === "string") {
      if (value.startsWith("{") || value.startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          return Serializer.deepDeserialize(parsed);
        } catch {}
      }
      if (!isNaN(new Date(value).getTime())) {
        return new Date(value);
      }
      if (value === "null") {
        return null;
      }
      return value;
    } else if (Array.isArray(value)) {
      return value.map((v) => Serializer.deepDeserialize(v));
    } else if (typeof value === "object" && value !== null) {
      const obj: any = {};
      for (const key in value) {
        obj[key] = Serializer.deepDeserialize(value[key]);
      }
      return obj;
    }
    return value;
  }

  static deepSerialize(value: any): any {
    if (value === null) {
      return "null";
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (Array.isArray(value)) {
      return JSON.stringify(value.map((v) => Serializer.deepSerialize(v)));
    } else if (typeof value === "object" && value !== null) {
      const obj: any = {};
      for (const key in value) {
        obj[key] = Serializer.deepSerialize(value[key]);
      }
      return JSON.stringify(obj);
    }
    return value;
  }
}

class LockManager {
  static tryLock(
    timeoutSeconds: number = 5
  ): GoogleAppsScript.Lock.Lock | null {
    const lock = LockService.getScriptLock();
    return lock.tryLock(timeoutSeconds * 1000) ? lock : null;
  }
}

export class Transaction<T> {
  private cache: T[] = [];
  private readonly sheetName: string;
  private readonly service: SpreadsheetService<T>;
  private committed = false;

  constructor(sheetName: string, service: SpreadsheetService<T>) {
    this.sheetName = sheetName;
    this.service = service;
    this.loadCache();
  }

  private loadCache(): void {
    try {
      const sheet = SpreadsheetAccessor.getSheet(this.sheetName);
      if (sheet && sheet.getLastRow() > 1) {
        this.cache = SpreadsheetAccessor.toObjectArray(
          sheet.getDataRange().getValues()
        ) as T[];
      } else {
        this.cache = [];
      }
    } catch (e) {
      console.error("Failed to load cache:", e);
      this.cache = [];
    }
  }

  add(entity: T): T {
    this.cache.push(entity);
    return entity;
  }

  addMany(entities: T[]): T[] {
    this.cache.push(...entities);
    return entities;
  }

  update(
    predicate: (entity: T) => boolean,
    updateEntity: (entity: T) => T
  ): number {
    let updatedCount = 0;
    for (let i = 0; i < this.cache.length; i++) {
      if (predicate(this.cache[i])) {
        this.cache[i] = updateEntity(this.cache[i]);
        updatedCount++;
      }
    }
    return updatedCount;
  }

  updateMany(ids: string[], updateEntity: (entity: T) => T): number {
    let updatedCount = 0;
    for (let i = 0; i < this.cache.length; i++) {
      const entity = this.cache[i] as any;
      if (ids.includes(entity.id)) {
        this.cache[i] = updateEntity(this.cache[i]);
        updatedCount++;
      }
    }
    return updatedCount;
  }

  delete(predicate: (entity: T) => boolean): number {
    const initialLength = this.cache.length;
    this.cache = this.cache.filter((entity) => !predicate(entity));
    return initialLength - this.cache.length;
  }

  deleteMany(ids: string[]): number {
    const initialLength = this.cache.length;
    this.cache = this.cache.filter((entity: any) => !ids.includes(entity.id));
    return initialLength - this.cache.length;
  }

  find(predicate: (entity: T) => boolean): T[] {
    return this.cache.filter(predicate);
  }

  findOne(predicate: (entity: T) => boolean): T | null {
    const results = this.find(predicate);
    return results.length > 0 ? results[0] : null;
  }

  commit(): void {
    if (this.committed) throw new Error("Transaction already committed.");
    const lock = LockManager.tryLock();
    if (!lock) throw new Error("Failed to acquire lock for commit.");
    try {
      let sheet = SpreadsheetAccessor.getSheet(this.sheetName);
      if (!sheet && this.cache.length > 0) {
        sheet = SpreadsheetAccessor.createSheet(
          this.sheetName,
          Object.keys(this.cache[0] as object)
        );
      }
      if (sheet) {
        sheet.clearContents();
        if (this.cache.length > 0) {
          const header = Object.keys(this.cache[0] as object);
          const rows = [
            header,
            ...this.cache.map((entity) =>
              SpreadsheetAccessor.toRowArray(entity)
            ),
          ];
          sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        }
      }
      this.committed = true;
    } finally {
      lock.releaseLock();
    }
  }
}

class SpreadsheetAccessor {
  static getSpreadsheetId(): string {
    const id =
      PropertiesService.getScriptProperties().getProperty("spreadsheet-id") ||
      "";
    if (!id) throw new Error("Spreadsheet ID not found in script properties.");
    return id;
  }

  static getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
    return SpreadsheetApp.openById(this.getSpreadsheetId());
  }

  static getSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet | null {
    return this.getSpreadsheet().getSheetByName(name);
  }

  static createSheet(
    name: string,
    columns: string[]
  ): GoogleAppsScript.Spreadsheet.Sheet {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
    sheet = ss.insertSheet(name, ss.getNumSheets());
    sheet.appendRow(columns);
    return sheet;
  }

  static toObjectArray(data: any[][]): any[] {
    if (data.length === 0) return [];
    const header = data[0];
    return data.slice(1).map((record) => {
      const obj: any = {};
      for (let i = 0; i < header.length; i++) {
        obj[header[i]] = Serializer.deepDeserialize(record[i]);
      }
      return obj;
    });
  }

  static toRowArray(entity: any): any[] {
    return Object.values(entity).map((value) =>
      Serializer.deepSerialize(value)
    );
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

  beginTransaction(): Transaction<T> {
    return new Transaction<T>(this.sheetName, this);
  }

  add(entity: T): T {
    const lock = LockManager.tryLock();
    if (!lock) throw new Error("Failed to acquire lock for add operation.");
    try {
      let sheet = SpreadsheetAccessor.getSheet(this.sheetName);
      if (!sheet)
        sheet = SpreadsheetAccessor.createSheet(
          this.sheetName,
          Object.keys(entity as object)
        );
      sheet.appendRow(SpreadsheetAccessor.toRowArray(entity));
      return entity;
    } finally {
      lock.releaseLock();
    }
  }

  update(
    predicate: (entity: T) => boolean,
    updateEntity: (entity: T) => T
  ): number {
    const lock = LockManager.tryLock();
    if (!lock) throw new Error("Failed to acquire lock for update operation.");
    try {
      const sheet = SpreadsheetAccessor.getSheet(this.sheetName);
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
          updatedRows.push(SpreadsheetAccessor.toRowArray(updated));
          updatedCount++;
        } else {
          updatedRows.push(values[i]);
        }
      }
      if (updatedCount > 0) {
        sheet
          .getRange(2, 1, updatedRows.length, header.length)
          .setValues(updatedRows);
      }
      return updatedCount;
    } finally {
      lock.releaseLock();
    }
  }

  delete(predicate: (entity: T) => boolean): number {
    const lock = LockManager.tryLock();
    if (!lock) throw new Error("Failed to acquire lock for delete operation.");
    try {
      const sheet = SpreadsheetAccessor.getSheet(this.sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return 0;
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const header = values.shift()!;
      const records = SpreadsheetAccessor.toObjectArray([
        header,
        ...values,
      ]) as T[];
      const remainingRecords = records.filter((record) => !predicate(record));
      const deletedCount = records.length - remainingRecords.length;
      sheet.clearContents();
      if (remainingRecords.length > 0) {
        const updatedValues = [
          header,
          ...remainingRecords.map((record) =>
            SpreadsheetAccessor.toRowArray(record)
          ),
        ];
        sheet
          .getRange(1, 1, updatedValues.length, updatedValues[0].length)
          .setValues(updatedValues);
      } else {
        sheet.getRange(1, 1, 1, header.length).setValues([header]);
      }
      return deletedCount;
    } finally {
      lock.releaseLock();
    }
  }

  find(predicate: (entity: T) => boolean): T[] {
    const lock = LockManager.tryLock();
    if (!lock) throw new Error("Failed to acquire lock for find operation.");
    try {
      const sheet = SpreadsheetAccessor.getSheet(this.sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return [];
      const records = SpreadsheetAccessor.toObjectArray(
        sheet.getDataRange().getValues()
      ) as T[];
      return records.filter(predicate);
    } finally {
      lock.releaseLock();
    }
  }

  findOne(predicate: (entity: T) => boolean): T | null {
    const results = this.find(predicate);
    return results.length > 0 ? results[0] : null;
  }
}

export interface ISpreadsheetService<T> {
  beginTransaction(): Transaction<T>;
  add(entity: T): T;
  update(
    predicate: (entity: T) => boolean,
    updateEntity: (entity: T) => T
  ): number;
  delete(predicate: (entity: T) => boolean): number;
  find(predicate: (entity: T) => boolean): T[];
  findOne(predicate: (entity: T) => boolean): T | null;
}
