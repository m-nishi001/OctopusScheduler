import localforage from 'localforage';
/**
 * 汎用的なローカルストレージサービス。
 * 各リポジトリから利用されることを想定しています。
 */
export class LocalStorageService {
    /**
     * コンストラクタでLocalForageのインスタンスをDI可能にします。
     *
     * @param dbName データベース名。アプリケーション全体で一意であるべきです。
     * @param storeName ストア名。ドメイン（エンティティ）ごとに設定されることを想定しています。
     */
    constructor(dbName, storeName) {
        Object.defineProperty(this, "lfInstance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
    async save(id, data) {
        const storedData = {
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
    async get(id) {
        const storedData = await this.lfInstance.getItem(id);
        return storedData?.data;
    }
    /**
     * 指定されたIDのデータを削除します。
     *
     * @param id データの識別子 (キー)。
     */
    async delete(id) {
        await this.lfInstance.removeItem(id);
    }
    /**
     * ストレージに保存されているすべてのデータを取得します。
     *
     * @returns すべてのデータをIDをキーとするMapで返します。
     */
    async getAll() {
        const results = new Map();
        await this.lfInstance.iterate((value, key) => {
            results.set(key, value.data);
        });
        return results;
    }
    /**
     * ストレージ内のすべてのデータをクリアします。
     */
    async clear() {
        await this.lfInstance.clear();
    }
    /**
     * 複数のデータを指定されたIDで保存します。
     * @param items 保存するデータを含むMap (キー: ID, 値: データ)
     * @returns 保存が完了したPromise
     */
    async saveMultiple(items) {
        const promises = [];
        items.forEach((value, id) => {
            const storedData = {
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
    async getMultiple(ids) {
        const results = new Map();
        const promises = ids.map(async (id) => {
            const storedData = await this.lfInstance.getItem(id);
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
    async removeMultiple(ids) {
        const promises = ids.map(id => this.lfInstance.removeItem(id));
        await Promise.all(promises);
    }
}
