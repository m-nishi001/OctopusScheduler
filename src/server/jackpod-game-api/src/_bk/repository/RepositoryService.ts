import { ISerializable } from "./ISerializable";

/**
 * スプレッドシートをデータストアとして利用する、パフォーマンス最適化済みの汎用リポジトリサービス。
 * 全件キャッシュ戦略により、読み取り処理を高速化し、スプレッドシートAPIの呼び出しを最小限に抑えます。
 * @template T 扱うデータの型。ISerializableを実装している必要がある。
 */
export class RepositoryService<T extends ISerializable> {
    private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet;
    private readonly cache: GoogleAppsScript.Cache.Cache;
    private readonly lock: GoogleAppsScript.Lock.Lock;

    // シート全体のデータをキャッシュするためのキー
    private readonly fullCacheKey: string;
    // スクリプト実行中のインメモリキャッシュ
    private dataMap: Map<string, T> | null = null;
    // ヘッダー情報を保持するインメモリキャッシュ
    private header: string[] | null = null;

    /**
     * RepositoryServiceのインスタンスを生成する
     * @param sheetName 操作対象のスプレッドシートのシート名
     */
    constructor(private readonly sheetName: string) {
        const SPREADSHEET_ID_KEY = 'SPREADSHEET_ID';
        const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
        if (spreadsheetId === null) throw new Error(`[${SPREADSHEET_ID_KEY}] is not set in Script Properties.`);

        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        this.sheet = spreadsheet.getSheetByName(this.sheetName) ?? spreadsheet.insertSheet(this.sheetName);
        this.cache = CacheService.getScriptCache();
        // 書き込み時の競合を防ぐため、スクリプト単位のロックを取得
        this.lock = LockService.getScriptLock();
        this.fullCacheKey = `repo_full_${this.sheetName}`;
    }

    /**
     * 新しいデータを1件作成する
     * @param dataToSave 保存するデータ本体
     * @returns 作成されたデータ (idが付与されている)
     */
    public create(dataToSave: Omit<T, 'id'>): T {
        const newId = Utilities.getUuid();
        const fullData = { ...dataToSave, id: newId } as T;

        this.lock.waitLock(15000); // 最大15秒待機
        try {
            const currentData = this.getHydratedData();
            // 最初のデータの場合、ヘッダーを確定させる
            if (currentData.size === 0) {
                this.ensureHeader(dataToSave);
            }
            currentData.set(newId, fullData);
            this.commit(currentData);
        } finally {
            this.lock.releaseLock();
        }

        return fullData;
    }

    /**
     * IDを指定してデータを1件読み込む
     * @param id 読み込むデータのID
     * @returns 読み込んだデータ。存在しない場合はnull。
     */
    public read(id: string): T | null {
        const data = this.getHydratedData();
        return data.get(id) ?? null;
    }

    /**
     * 既存のデータを1件更新する
     * @param dataToUpdate 更新するデータ。idで対象を特定する。
     * @returns 更新後のデータ
     */
    public update(dataToUpdate: T): T {
        this.lock.waitLock(15000);
        try {
            const currentData = this.getHydratedData();
            if (!currentData.has(dataToUpdate.id)) {
                throw new Error(`Data with id "${dataToUpdate.id}" not found.`);
            }
            currentData.set(dataToUpdate.id, dataToUpdate);
            this.commit(currentData);
        } finally {
            this.lock.releaseLock();
        }
        return dataToUpdate;
    }

    /**
     * データを1件作成または更新する
     * @param dataToUpsert 作成または更新するデータ
     * @returns 作成または更新されたデータ
     */
    public upsert(dataToUpsert: T): T {
        this.lock.waitLock(15000);
        try {
            const currentData = this.getHydratedData();
            // ヘッダーが存在しない可能性を考慮
            if (currentData.size === 0) {
                const { id, ...dataToSave } = dataToUpsert;
                this.ensureHeader(dataToSave);
            }
            currentData.set(dataToUpsert.id, dataToUpsert);
            this.commit(currentData);
        } finally {
            this.lock.releaseLock();
        }
        return dataToUpsert;
    }

    /**
     * IDを指定してデータを1件削除する
     * @param id 削除するデータのID
     */
    public delete(id: string): void {
        this.lock.waitLock(15000);
        try {
            const currentData = this.getHydratedData();
            if (currentData.delete(id)) {
                this.commit(currentData);
            } else {
                console.warn(`Attempted to delete non-existent data with id "${id}".`);
            }
        } finally {
            this.lock.releaseLock();
        }
    }

    /**
     * シート内の全データをリストで取得する (キャッシュ優先)
     * @returns 全データの配列
     */
    public list(): T[] {
        return Array.from(this.getHydratedData().values());
    }

    /**
     * シート内の既存データ（ヘッダーを除く）をすべて削除し、新しいデータで置き換える
     * @param dataToReplace 置き換える新しいデータの配列
     */
    public replaceAll(dataToReplace: T[]): void {
        this.lock.waitLock(15000);
        try {
            // ヘッダーを確定させる
            if (dataToReplace.length > 0) {
                const { id, ...firstItem } = dataToReplace[0];
                this.ensureHeader(firstItem);
            } else {
                this.getHeader(); // 既存ヘッダーを読み込む試み
            }

            const newMap = new Map<string, T>();
            dataToReplace.forEach(item => newMap.set(item.id, item));
            this.commit(newMap);
        } finally {
            this.lock.releaseLock();
        }
    }

    // --- Private Helper Methods ---

    /**
     * インスタンス、スクリプトキャッシュ、またはスプレッドシートからデータを読み込み、
     * Map形式で返す。読み取り処理の中心となるメソッド。
     * @returns idをキーとするデータMap
     */
    private getHydratedData(): Map<string, T> {
        // 1. インスタンスキャッシュの確認
        if (this.dataMap) {
            return this.dataMap;
        }

        // 2. スクリプトキャッシュの確認
        const cachedData = this.cache.get(this.fullCacheKey);
        if (cachedData) {
            try {
                const parsed: T[] = JSON.parse(cachedData, this.jsonReviver);
                this.dataMap = new Map(parsed.map(item => [item.id, item]));
                return this.dataMap;
            } catch (e) {
                // パース失敗時はキャッシュを削除
                this.cache.remove(this.fullCacheKey);
            }
        }

        // 3. スプレッドシートから読み込み
        const header = this.getHeader();
        if (header.length === 0 || this.sheet.getLastRow() < 2) {
            this.dataMap = new Map();
            return this.dataMap;
        }

        const values = this.sheet.getRange(2, 1, this.sheet.getLastRow() - 1, header.length).getValues();
        const newMap = new Map<string, T>();
        values.forEach(row => {
            const obj = this.rowToObject(row);
            newMap.set(obj.id, obj);
        });

        // 読み込んだデータをキャッシュに保存
        this.cache.put(this.fullCacheKey, JSON.stringify(Array.from(newMap.values())), 21600); // 6時間
        this.dataMap = newMap;

        return this.dataMap;
    }

    /**
     * メモリ上のデータマップをスプレッドシートとキャッシュに書き込む。
     * 書き込み処理の中心となるメソッド。
     * @param dataMap 書き込むデータ全体
     */
    private commit(dataMap: Map<string, T>): void {
        const header = this.getHeader();
        if (header.length === 0) {
            // データもヘッダーも無い場合は何もしない
            if (dataMap.size === 0) return;
            // データがあるのにヘッダーが無い場合はエラー（ensureHeaderが呼ばれているはず）
            throw new Error("Cannot commit data without a header.");
        }

        const dataArray = Array.from(dataMap.values());
        const rowsData = dataArray.map(item => this.objectToRow(item));

        // シートを一旦クリアし、ヘッダーとデータを一括書き込み
        this.sheet.clear();
        this.sheet.getRange(1, 1, 1, header.length).setValues([header]);
        if (rowsData.length > 0) {
            this.sheet.getRange(2, 1, rowsData.length, header.length).setValues(rowsData);
        }

        // キャッシュを更新
        this.cache.put(this.fullCacheKey, JSON.stringify(dataArray), 21600);
        // インスタンスキャッシュを更新
        this.dataMap = dataMap;
    }

    /**
     * シートにヘッダー行が存在しない場合、指定されたデータオブジェクトのキーを元にヘッダーを作成する
     */
    private ensureHeader(dataObject: object): void {
        // this.header が既に設定されているか、シートにヘッダーが既にある場合は何もしない
        if (this.header || this.sheet.getLastRow() > 0) return;

        const newHeader = ['id', ...Object.keys(dataObject)];
        this.header = newHeader;
    }

    /**
     * ヘッダー行をシートから読み込む。クラス内のキャッシュを利用する。
     */
    private getHeader(): string[] {
        if (this.header) return this.header;
        if (this.sheet.getLastRow() === 0) {
            this.header = [];
            return this.header;
        }

        const headerRow = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
        // 空のセルを除外してヘッダーとする
        this.header = headerRow.filter(h => h && typeof h === 'string' && h.length > 0);

        return this.header;
    }

    /**
     * オブジェクトを行データ（配列）に変換する
     */
    private objectToRow(dataObject: T): any[] {
        return this.getHeader().map(key => {
            const value = dataObject[key as keyof T];
            if (value === undefined || value === null) return "";
            if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
                return JSON.stringify(value);
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
    }

    /**
     * 行データ（配列）をオブジェクトに変換する
     */
    private rowToObject(row: any[]): T {
        const header = this.getHeader();
        const obj: { [key: string]: any } = {};

        header.forEach((key, i) => {
            const value = row[i];
            // このロジックは元の実装を踏襲
            if (typeof value === 'string') {
                if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
                    try {
                        obj[key] = JSON.parse(value);
                    } catch (e) {
                        obj[key] = value;
                    }
                } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
                    obj[key] = new Date(value);
                } else {
                    obj[key] = value;
                }
            } else {
                obj[key] = value;
            }
        });
        return obj as T;
    }

    /**
     * JSON.parseでDateオブジェクトを復元するためのreviver
     */
    private jsonReviver(key: string, value: any): any {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
            return new Date(value);
        }
        return value;
    }
}
