/**
 * @typedef {object} SuccessResponse
 * @property {string} status - 処理が成功したことを示します。
 * @property {T} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse<T> {
    public readonly status: string = 'success';
    public readonly data: T;
    constructor(data: T) {
        this.data = data;
    }
}