/**
 * 汎用的なストレージサービスを提供します。
 * キーとデータ、および最終更新日時を保存します。
 */
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
}