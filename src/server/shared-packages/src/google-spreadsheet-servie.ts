// ==============================================================================
// 1. スプレッドシート関連の実装をネームスペースでグループ化
// ==============================================================================
namespace SpreadsheetDataStore {

    /**
     * Google SpreadsheetのIDを表現する値オブジェクト
     * Represents a Value Object for a Google Spreadsheet ID.
     */
    export class SpreadsheetId {
        readonly id: string;
        private constructor(id: string) {
            this.id = id;
        }

        static create(id: string): SpreadsheetId | null {
            if (!id) {
                Logger.log(`[SpreadsheetId.create] ID is empty.`);
                return null;
            }
            return new SpreadsheetId(id);
        }
    }

    /**
     * Google Spreadsheetのシート名を表現する値オブジェクト
     * Represents a Value Object for a Google Spreadsheet sheet name.
     */
    export class SpreadsheetName {
        readonly name: string;
        private constructor(name: string) {
            this.name = name;
        }

        static create(name: string): SpreadsheetName | null {
            if (!name) {
                Logger.log(`[SpreadsheetName.create] Name is empty.`);
                return null;
            }
            return new SpreadsheetName(name);
        }
    }

    /**
     * スプレッドシートの列定義を表現する値オブジェクト
     * Represents a Value Object for a spreadsheet column definition.
     */
    export class ColumnDefinition {
        readonly columnName: string;
        private constructor(columnName: string) {
            this.columnName = columnName;
        }

        static create(columnName: string): ColumnDefinition | null {
            if (!columnName) {
                Logger.log(`[ColumnDefinition.create] Column name is empty.`);
                return null;
            }
            return new ColumnDefinition(columnName);
        }
    }

    /**
     * スクリプトプロパティからスプレッドシートIDを取得するサービス
     * Service to get the Spreadsheet ID from script properties.
     */
    export class SpreadsheetInfo {
        static getSpreadsheetId(): SpreadsheetId {
            const spreadSheetId = PropertiesService.getScriptProperties().getProperty("spreadsheet-id") || "";
            const id = SpreadsheetId.create(spreadSheetId);
            if (!id) {
                throw new Error("Spreadsheet ID not found in script properties.");
            }
            return id;
        }
    }

    /**
     * LockServiceを利用した排他制御クラス
     * Ensures exclusive access using the LockService.
     */
    export class SpreadsheetLock implements Disposable {
        private constructor() { }

        [Symbol.dispose](): void {
            LockService.getScriptLock().releaseLock();
            Logger.log(`[SpreadsheetLock.dispose] Released script lock.`);
        }

        static tryLock(timeoutSeconds: number = 5): SpreadsheetLock | null {
            const lock = LockService.getScriptLock().tryLock(timeoutSeconds * 1000);
            if (!lock) {
                Logger.log(`[SpreadsheetLock.tryLock] Failed to get script lock in ${timeoutSeconds} seconds.`);
                return null;
            }
            Logger.log(`[SpreadsheetLock.tryLock] Got script lock.`);
            return new SpreadsheetLock();
        }
    }

    /**
     * 汎用的なスプレッドシートへのアクセスを管理する内部クラス
     * Internal class managing general access to the spreadsheet.
     */
    export class SpreadsheetAccessor {
        private readonly spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

        constructor() {
            const spreadSheetId = SpreadsheetInfo.getSpreadsheetId();
            this.spreadsheet = SpreadsheetApp.openById(spreadSheetId.id);
        }

        /**
         * 指定されたシートを取得します。存在しない場合はnullを返します。
         * Gets the specified sheet. Returns null if it doesn't exist.
         */
        getSheet(name: SpreadsheetName): GoogleAppsScript.Spreadsheet.Sheet | null {
            return this.spreadsheet.getSheetByName(name.name);
        }

        /**
         * 指定されたシートを作成します。すでに存在する場合は既存のシートを返します。
         * Creates the specified sheet. Returns the existing sheet if it already exists.
         */
        createSheet(name: SpreadsheetName, columnDefinitions: ColumnDefinition[]): GoogleAppsScript.Spreadsheet.Sheet {
            let sheet = this.getSheet(name);
            if (sheet) {
                return sheet;
            }

            Logger.log(`[SpreadsheetAccessor.createSheet] creating new sheet named ${name.name}...`);
            const newSheet = this.spreadsheet.insertSheet(name.name, this.spreadsheet.getNumSheets());
            Logger.log(`[SpreadsheetAccessor.createSheet] Sheet named ${name.name} was created.`);

            Logger.log(`[SpreadsheetAccessor.createSheet] Adding header row...`);
            newSheet.appendRow(columnDefinitions.map(def => def.columnName));
            Logger.log(`[SpreadsheetAccessor.createSheet] Added header row.`);

            return newSheet;
        }

    }

    /**
     * IRepositoryをスプレッドシートで実装するクラス
     * Class implementing IRepository with a spreadsheet backend.
     */
    export class DataStoreRepository<T> implements IRepository<T> {

        private readonly sheetName: SpreadsheetName;
        private readonly accessor: SpreadsheetAccessor;

        /**
         * JSONセル値のデシリアライズ時にISO8601日付文字列をDate型へ変換する再帰関数
         */
        private static parseWithDateConversion(obj: any): any {
            if (Array.isArray(obj)) {
                return obj.map(DataStoreRepository.parseWithDateConversion);
            } else if (obj && typeof obj === 'object') {
                for (const key in obj) {
                    obj[key] = DataStoreRepository.parseWithDateConversion(obj[key]);
                }
                return obj;
            } else if (typeof obj === 'string' && obj.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)) {
                // JST変換例: Utilities.formatDate(new Date(obj), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
                return new Date(obj);
            }
            return obj;
        }

        /**
         * 2次元配列をオブジェクト配列に変換する共通処理
         */
        private toObjectArray(data: any[][]): any[] {
            if (data.length === 0) return [];
            const header = data[0];
            const array = data.slice(1).map(record =>
                record.reduce((previous, current, columnIndex) => {
                    const columnName = header[columnIndex];
                    previous[columnName] = (typeof current === 'string' && current.startsWith('{'))
                        ? DataStoreRepository.parseWithDateConversion(JSON.parse(current))
                        : current;
                    return previous;
                }, {})
            );
            return array;
        }

        constructor(sheetName: SpreadsheetName, accessor: SpreadsheetAccessor) {
            this.sheetName = sheetName;
            this.accessor = accessor;
        }

        /**
         * JSオブジェクトをスプレッドシート用配列に変換する共通処理
         */
        private toRowArray(entity: T): any[] {
            return Object.values(entity as object).map(value =>
                typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : value
            );
        }

        /**
         * 新規追加
         */
        add(entity: T): T {
            using lock = SpreadsheetLock.tryLock();
            if (!lock) {
                throw new Error("Failed to acquire lock for add operation.");
            }
            const sheet = this.accessor.getSheet(this.sheetName);
            const columnDefinitions = Object.keys(entity as object).map(key => ColumnDefinition.create(key));
            if (columnDefinitions.some(def => !def)) {
                throw new Error("Invalid entity properties for column definitions.");
            }
            const targetSheet = sheet ?? this.accessor.createSheet(this.sheetName, columnDefinitions as ColumnDefinition[]);
            const values = this.toRowArray(entity);
            targetSheet.appendRow(values);
            Logger.log(`[DataStoreRepository.add] Inserted new record.`);
            return entity;
        }

        /**
         * 更新
         */
        update(predicate: (entity: T) => boolean, updateEntity: (entity: T) => T): number {
            using lock = SpreadsheetLock.tryLock();
            if (!lock) {
                throw new Error("Failed to acquire lock for update operation.");
            }
            const sheet = this.accessor.getSheet(this.sheetName);
            if (!sheet) return 0;
            const values = sheet.getDataRange().getValues();
            if (values.length <= 1) return 0;
            const header = values[0];
            let updatedCount = 0;
            for (let i = 1; i < values.length; i++) {
                const record: any = {};
                for (let j = 0; j < header.length; j++) {
                    record[header[j]] = values[i][j];
                }
                if (predicate(record)) {
                    const updated = updateEntity(record);
                    const updatedRow = this.toRowArray(updated);
                    sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
                    updatedCount++;
                }
            }
            Logger.log(`[DataStoreRepository.update] Updated ${updatedCount} record(s).`);
            return updatedCount;
        }

        /**
         * 条件に一致するエンティティをすべて検索します。
         * Finds all entities that match the predicate.
         */
        find(predicate: (entity: T) => boolean): T[] {
            using lock = SpreadsheetLock.tryLock();
            if (!lock) {
                throw new Error("Failed to acquire lock for find operation.");
            }

            const sheet = this.accessor.getSheet(this.sheetName);
            if (!sheet || sheet.getLastRow() <= 1) return [];

            const records = this.toObjectArray(sheet.getDataRange().getValues()) as T[];
            return records.filter(predicate);
        }

        /**
         * 条件に一致する最初のエンティティを検索します。
         * Finds the first entity that matches the predicate.
         */
        findOne(predicate: (entity: T) => boolean): T | null {
            const results = this.find(predicate);
            return results.length > 0 ? results[0] : null;
        }

        /**
         * 条件に一致するエンティティをすべて削除します。
         * Deletes all entities that match the predicate.
         */
        delete(predicate: (entity: T) => boolean): boolean {
            using lock = SpreadsheetLock.tryLock();
            if (!lock) {
                throw new Error("Failed to acquire lock for delete operation.");
            }

            const sheet = this.accessor.getSheet(this.sheetName);
            if (!sheet || sheet.getLastRow() <= 1) return false;

            const dataRange = sheet.getDataRange();
            const values = dataRange.getValues();
            const header = values.shift()!; // Get header and remove from array

            const records = this.toObjectArray([header, ...values]) as T[];
            const remainingRecords = records.filter(record => !predicate(record));

            // Clear the sheet first to remove all existing data.
            sheet.clearContents();

            if (remainingRecords.length > 0) {
                // Prepare new data to write back, including the header.
                const updatedValues = [header, ...remainingRecords.map(record => Object.values(record as object))];
                sheet.getRange(1, 1, updatedValues.length, updatedValues[0].length).setValues(updatedValues);
            } else {
                // If all records are deleted, just write back the header.
                sheet.getRange(1, 1, 1, header.length).setValues([header]);
            }

            const deletedCount = records.length - remainingRecords.length;
            Logger.log(`[DataStoreRepository.delete] Deleted ${deletedCount} record(s).`);
            return deletedCount > 0;
        }
    }
}


// ==============================================================================
// 2. ドメイン層・アプリケーション層のインターフェース (Domain & Application Interfaces)
// ==============================================================================

/**
 * データストアへのアクセスを抽象化するリポジトリインターフェース
 * Repository interface abstracting data store access.
 */
export interface IRepository<T> {
    add(entity: T): T;
    update(predicate: (entity: T) => boolean, updateEntity: (entity: T) => T): number;
    delete(predicate: (entity: T) => boolean): boolean;
    find(predicate: (entity: T) => boolean): T[];
    findOne(predicate: (entity: T) => boolean): T | null;
}

// ==============================================================================
// 3. 公開サービス (Public Service)
// ==============================================================================

/**
 * 外部に公開される唯一のサービス。リポジトリを管理し提供します。
 * The only public service. Manages and provides repositories.
 */
export class DataAccessService {
    private static readonly accessor: SpreadsheetDataStore.SpreadsheetAccessor = new SpreadsheetDataStore.SpreadsheetAccessor();

    /**
     * 指定されたシート名に対応する型安全なリポジトリを取得します。
     * Gets a type-safe repository for the given sheet name.
     */
    public static getRepository<T>(sheetName: string): IRepository<T> {
        const name = SpreadsheetDataStore.SpreadsheetName.create(sheetName);
        if (!name) {
            throw new Error("Invalid sheet name provided.");
        }
        return new SpreadsheetDataStore.DataStoreRepository<T>(name, this.accessor);
    }
}
