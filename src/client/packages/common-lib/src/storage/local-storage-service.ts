import localforage from 'localforage';

export interface StoredData<T> {
    data: T;
    updatedAt: number; // 最終更新日時 (Unixタイムスタンプ)
}

export interface IStorageService {
    /**
     * データを指定されたIDで保存します。
     * @param id データの識別子 (キー)
     * @param data 保存するデータ (JavaScriptオブジェクト, Blob, ArrayBufferなど)
     * @returns 保存が完了したPromise
     */
    save(id: string, data: any): Promise<void>;

    /**
     * 指定されたIDのデータを取得します。
     * @param id データの識別子 (キー)
     * @returns 取得したデータを含むPromise (データが見つからない場合はundefined)
     */
    get<T>(id: string): Promise<T | undefined>;

    /**
     * 指定されたIDのデータを削除します。
     * @param id データの識別子 (キー)
     * @returns 削除が完了したPromise
     */
    delete(id: string): Promise<void>;

    /**
     * ストレージ内のすべてのデータをクリアします。
     * @returns クリアが完了したPromise
     */
    clear(): Promise<void>;

    /**
     * 複数のデータを指定されたIDでストレージに保存します。
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
     * ストレージに保存されているすべてのデータを取得します。
     * @returns すべてのデータを含むMap (キー: ID, 値: データ)
     */
    getAll<T>(): Promise<Map<string, T>>;

    /**
     * 複数のIDに対応するデータをストレージから一括で削除します。
     * @param ids 削除するデータの識別子 (キー) の配列
     * @returns 削除が完了したPromise
     */
    removeMultiple(ids: string[]): Promise<void>;
}

export class LocalStorageService implements IStorageService {
    constructor() {
        localforage.config({
            name: 'octopus-scheduler-db',
            storeName: 'dataItems'
        });
    }

    async save(id: string, data: any): Promise<void> {
        const storedData: StoredData<typeof data> = {
            data: data,
            updatedAt: Date.now(), // 現在のタイムスタンプを付与
        };
        await localforage.setItem(id, storedData);
    }

    async get<T>(id: string): Promise<T | undefined> {
        const storedData: StoredData<T> | null = await localforage.getItem(id);
        return storedData?.data; // データが見つかれば data 部分を返し、そうでなければ undefined
    }

    async delete(id: string): Promise<void> {
        await localforage.removeItem(id);
    }

    async clear(): Promise<void> {
        await localforage.clear();
    }

    async saveMultiple<T>(items: Map<string, T>): Promise<void> {
        const promises: Promise<any>[] = [];
        items.forEach((value, id) => {
            const storedData: StoredData<T> = {
                data: value,
                updatedAt: Date.now(),
            };
            promises.push(localforage.setItem(id, storedData));
        });
        await Promise.all(promises);
    }

    async getMultiple<T>(ids: string[]): Promise<Map<string, T | undefined>> {
        const results = new Map<string, T | undefined>();
        const promises = ids.map(async (id) => {
            const storedData: StoredData<T> | null = await localforage.getItem(id);
            results.set(id, storedData?.data);
        });
        await Promise.all(promises);
        return results;
    }

    async getAll<T>(): Promise<Map<string, T>> {
        const results = new Map<string, T>();
        await localforage.iterate((value: StoredData<T>, key: string) => {
            results.set(key, value.data);
        });
        return results;
    }

    async removeMultiple(ids: string[]): Promise<void> {
        const promises = ids.map(id => localforage.removeItem(id));
        await Promise.all(promises);
    }
}