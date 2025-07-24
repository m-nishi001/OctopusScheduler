/**
 * 汎用リポジトリの契約を定義するインターフェース
 * ドメイン層に配置され、永続化の詳細から独立します。
 * @template T ドメインオブジェクトの型
 * @template K キーの型
 */
interface IRepository<T, K> {
    /**
     * データを新規作成します（単発）。
     * @param item 作成するデータオブジェクト
     * @returns 作成されたデータオブジェクト
     */
    create(item: T): T;

    /**
     * データを新規作成します（バッチ）。
     * @param items 作成するデータオブジェクトの配列
     * @returns 作成されたデータオブジェクトの配列
     */
    createBatch(items: T[]): T[];

    /**
     * データを読み込みます（単発）。
     * @param key データを識別するキー
     * @returns 読み込まれたデータオブジェクト、またはnull
     */
    read(key: K): T | null;

    /**
     * 全てのデータを読み込みます。
     * @returns 全てのデータオブジェクトの配列
     */
    readAll(): T[];

    /**
     * データを更新します（単発）。
     * @param key データを識別するキー
     * @param updates 更新するデータオブジェクト（部分更新可）
     * @returns 更新されたデータオブジェクト、またはnull
     */
    update(key: K, updates: Partial<T>): T | null;

    /**
     * データを更新します（バッチ）。
     * @param updatesMap キーと更新内容のマップ
     * @returns 更新されたデータオブジェクトの配列
     */
    updateBatch(updatesMap: Map<K, Partial<T>>): (T | null)[];

    /**
     * データを削除します（単発）。
     * @param key データを識別するキー
     * @returns 削除が成功したかどうかの真偽値
     */
    delete(key: K): boolean;

    /**
     * データを削除します（バッチ）。
     * @param keys 削除するキーの配列
     * @returns 削除が成功したかどうかの真偽値
     */
    deleteBatch(keys: K[]): boolean;
}