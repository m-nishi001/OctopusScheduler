import { ref } from 'vue';
import { LocalStorageService } from '../../common-lib/src/storage/local-storage-service';

/**
 * LocalStorageService を使用してローカルストレージ操作を行うための Composable 関数。
 * データはメモリにキャッシュされず、必要な時にのみストレージから取得されます。
 * 複数のアイテムに対する操作もサポートします。
 */
export function useLocalStorage() {
    // LocalStorageService のインスタンスを作成
    // アプリケーション全体でシングルトンとして管理することも可能だが、
    // ここでは Composable ごとにインスタンスを作成するシンプルな方法を採用
    const storageService = new LocalStorageService('app', 'default');

    const loading = ref(false); // 非同期操作のローディング状態
    const error = ref<Error | null>(null); // 非同期操作で発生したエラー

    /**
     * データを指定されたIDでストレージに保存します。
     * @param id データの識別子 (キー)
     * @param value 保存するデータ
     * @returns 保存が完了したPromise
     */
    const save = async <T>(id: string, value: T): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            await storageService.save(id, value);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error(`Error saving data with ID ${id}:`, e);
        } finally {
            loading.value = false;
        }
    };

    /**
     * 指定されたIDのデータをストレージから取得します。
     * データはメモリにキャッシュされず、直接返されます。
     * @param id データの識別子 (キー)
     * @returns 取得したデータを含むPromise (データが見つからない場合はundefined)
     */
    const get = async <T>(id: string): Promise<T | undefined> => {
        loading.value = true;
        error.value = null;
        try {
            return await storageService.get<T>(id);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error(`Error getting data with ID ${id}:`, e);
            return undefined; // エラー発生時は undefined を返す
        } finally {
            loading.value = false;
        }
    };

    /**
     * 指定されたIDのデータをストレージから削除します。
     * @param id データの識別子 (キー)
     * @returns 削除が完了したPromise
     */
    const remove = async (id: string): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            await storageService.delete(id);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error(`Error removing data with ID ${id}:`, e);
        } finally {
            loading.value = false;
        }
    };

    /**
     * ストレージ内のすべてのデータをクリアします。
     * @returns クリアが完了したPromise
     */
    const clear = async (): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            await storageService.clear();
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error('Error clearing storage:', e);
        } finally {
            loading.value = false;
        }
    };

    /**
     * 複数のデータを指定されたIDでストレージに保存します。
     * LocalStorageService の saveMultiple を使用します。
     * @param items 保存するデータを含むMap (キー: ID, 値: データ)
     * @returns 保存が完了したPromise
     */
    const saveMultiple = async <T>(items: Map<string, T>): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            await storageService.saveMultiple(items);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error('Error saving multiple data items:', e);
        } finally {
            loading.value = false;
        }
    };

    /**
     * 複数のIDに対応するデータをストレージから一括で取得します。
     * LocalStorageService の getMultiple を使用します。
     * @param ids 取得するデータの識別子 (キー) の配列
     * @returns 取得したデータを含むMap (キー: ID, 値: データまたはundefined)
     */
    const getMultiple = async <T>(ids: string[]): Promise<Map<string, T | undefined>> => {
        loading.value = true;
        error.value = null;
        try {
            return await storageService.getMultiple<T>(ids);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error('Error getting multiple data items:', e);
            return new Map(); // エラー発生時は空のMapを返す
        } finally {
            loading.value = false;
        }
    };

    /**
     * ストレージに保存されているすべてのデータを取得します。
     * LocalStorageService の getAll を使用します。
     * @returns すべてのデータを含むMap (キー: ID, 値: データ)
     */
    const getAll = async <T>(): Promise<Map<string, T>> => {
        loading.value = true;
        error.value = null;
        try {
            return await storageService.getAll<T>();
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error('Error getting all data items:', e);
            return new Map(); // エラー発生時は空のMapを返す
        } finally {
            loading.value = false;
        }
    };

    /**
     * 複数のIDに対応するデータをストレージから一括で削除します。
     * LocalStorageService の removeMultiple を使用します。
     * @param ids 削除するデータの識別子 (キー) の配列
     * @returns 削除が完了したPromise
     */
    const removeMultiple = async (ids: string[]): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            await storageService.removeMultiple(ids);
        } catch (e) {
            if (e instanceof Error) {
                error.value = e;
            } else {
                error.value = new Error(String(e));
            }
            console.error('Error removing multiple data items:', e);
        } finally {
            loading.value = false;
        }
    };

    return {
        save,
        get,
        remove,
        clear,
        saveMultiple,
        getMultiple,
        getAll,
        removeMultiple,
        loading,
        error,
    };
}