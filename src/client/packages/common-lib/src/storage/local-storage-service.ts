import localforage from 'localforage';

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
export class LocalStorageService {
    private lfInstance: LocalForage;

    /**
     * コンストラクタでLocalForageのインスタンスをDI可能にします。
     *
     * @param dbName データベース名。アプリケーション全体で一意であるべきです。
     * @param storeName ストア名。ドメイン（エンティティ）ごとに設定されることを想定しています。
     */
    constructor(dbName: string, storeName: string) {
        this.lfInstance = localforage.createInstance({
            name: dbName,
            storeName: storeName,
        });
    }

    /**
     * データを指定されたIDで保存します。
     *
     * @param id データの識別子 (キー)。
     * @param data 保存するデータ。
     */
    async save<T>(id: string, data: T): Promise<void> {
        const storedData: StoredData<T> = {
            data: data,
            updatedAt: Date.now(),
        };
        await this.lfInstance.setItem(id, storedData);
    }

    /**
     * 指定されたIDのデータを取得します。
     *
     * @param id データの識別子 (キー)。
     * @returns 取得したデータ。見つからない場合はundefined。
     */
    async get<T>(id: string): Promise<T | undefined> {
        const storedData: StoredData<T> | null = await this.lfInstance.getItem(id);
        return storedData?.data;
    }

    /**
     * 指定されたIDのデータを削除します。
     *
     * @param id データの識別子 (キー)。
     */
    async delete(id: string): Promise<void> {
        await this.lfInstance.removeItem(id);
    }

    /**
     * ストレージに保存されているすべてのデータを取得します。
     *
     * @returns すべてのデータをIDをキーとするMapで返します。
     */
    async getAll<T>(): Promise<Map<string, T>> {
        const results = new Map<string, T>();
        await this.lfInstance.iterate((value: StoredData<T>, key: string) => {
            try {
                results.set(key, value.data);
            } catch (err) {
                console.error(`[getAll] Error setting key:`, key, err);
            }
        });
        return results;
    }

    /**
     * ストレージ内のすべてのデータをクリアします。
     */
    async clear(): Promise<void> {
        await this.lfInstance.clear();
    }

    /**
     * 複数のデータを指定されたIDで保存します。
     * @param items 保存するデータを含むMap (キー: ID, 値: データ)
     * @returns 保存が完了したPromise
     */
    async saveMultiple<T>(items: Map<string, T>): Promise<void> {
        const promises: Promise<any>[] = [];
        items.forEach((value, id) => {
            const storedData: StoredData<T> = {
                data: value,
                updatedAt: Date.now(),
            };
            promises.push(this.lfInstance.setItem(id, storedData));
        });
        await Promise.all(promises);
    }

    /**
     * 複数のIDに対応するデータをストレージから一括で取得します。
     * @param ids 取得するデータの識別子 (キー) の配列
     * @returns 取得したデータを含むMap (キー: ID, 値: データまたはundefined)
     */
    async getMultiple<T>(ids: string[]): Promise<Map<string, T | undefined>> {
        const results = new Map<string, T | undefined>();
        const promises = ids.map(async (id) => {
            const storedData: StoredData<T> | null = await this.lfInstance.getItem(id);
            results.set(id, storedData?.data);
        });
        await Promise.all(promises);
        return results;
    }

    /**
     * 複数のIDに対応するデータをストレージから一括で削除します。
     * @param ids 削除するデータの識別子 (キー) の配列
     * @returns 削除が完了したPromise
     */
    async removeMultiple(ids: string[]): Promise<void> {
        const promises = ids.map(id => this.lfInstance.removeItem(id));
        await Promise.all(promises);
    }
}
