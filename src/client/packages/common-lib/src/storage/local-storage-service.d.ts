/**
 * データの永続化に使用されるDTO（Data Transfer Object）。
 * 永続化のためのメタデータ（最終更新日時など）を含みます。
 */
export interface StoredData<T> {
    data: T;
    updatedAt: number;
}
/**
 * 汎用的なローカルストレージサービス。
 * 各リポジトリから利用されることを想定しています。
 */
export declare class LocalStorageService {
    private lfInstance;
    /**
     * コンストラクタでLocalForageのインスタンスをDI可能にします。
     *
     * @param dbName データベース名。アプリケーション全体で一意であるべきです。
     * @param storeName ストア名。ドメイン（エンティティ）ごとに設定されることを想定しています。
     */
    constructor(dbName: string, storeName: string);
    /**
     * データを指定されたIDで保存します。
     *
     * @param id データの識別子 (キー)。
     * @param data 保存するデータ。
     */
    save<T>(id: string, data: T): Promise<void>;
    /**
     * 指定されたIDのデータを取得します。
     *
     * @param id データの識別子 (キー)。
     * @returns 取得したデータ。見つからない場合はundefined。
     */
    get<T>(id: string): Promise<T | undefined>;
    /**
     * 指定されたIDのデータを削除します。
     *
     * @param id データの識別子 (キー)。
     */
    delete(id: string): Promise<void>;
    /**
     * ストレージに保存されているすべてのデータを取得します。
     *
     * @returns すべてのデータをIDをキーとするMapで返します。
     */
    getAll<T>(): Promise<Map<string, T>>;
    /**
     * ストレージ内のすべてのデータをクリアします。
     */
    clear(): Promise<void>;
    /**
     * 複数のデータを指定されたIDで保存します。
     * @param items 保存するデータを含むMap (キー: ID, 値: データ)
     * @returns 保存が完了したPromise
     */
    saveMultiple<T>(items: Map<string, T>): Promise<void>;
    /**
     * 複数のIDに対応するデータをストレージから一括で取得します。
     * @param ids 取得するデータの識別子 (キー) の配列
     * @returns 取得したデータを含むMap (キー: ID, 値: データまたはundefined)
     */
    getMultiple<T>(ids: string[]): Promise<Map<string, T | undefined>>;
    /**
     * 複数のIDに対応するデータをストレージから一括で削除します。
     * @param ids 削除するデータの識別子 (キー) の配列
     * @returns 削除が完了したPromise
     */
    removeMultiple(ids: string[]): Promise<void>;
}
