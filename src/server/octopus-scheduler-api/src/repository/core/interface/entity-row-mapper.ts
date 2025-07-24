/**
 * ドメインオブジェクトと永続化レイヤーの行データ（unknown[]）を相互に変換するインターフェース
 * シリアライザー/デシリアライザーの役割を担います。
 * @template T ドメインオブジェクトの型
 */
interface IEntityRowMapper<T> {
    /**
     * データオブジェクトTをシートの1行のデータに変換します。
     * @param item データオブジェクト
     * @returns シートの1行のデータ
     */
    entityToRow(item: T): unknown[];

    /**
     * シートの1行のデータをデータオブジェクトTに変換します。
     * @param row シートの1行のデータ
     * @returns 変換されたデータオブジェクト
     */
    rowToEntity(row: unknown[]): T;

    getHeader(): string[];
}