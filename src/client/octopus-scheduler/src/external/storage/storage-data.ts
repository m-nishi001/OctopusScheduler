// 保存するデータの構造
export interface StoredData<T> {
    data: T;
    updatedAt: number; // 最終更新日時 (Unixタイムスタンプ)
}