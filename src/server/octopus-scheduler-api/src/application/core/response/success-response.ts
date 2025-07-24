/**
 * @typedef {object} SuccessResponse
 * @property {'success'} status - 処理が成功したことを示します。
 * @property {T} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse<T> {
    status: string = 'success';
    data: T;

    constructor(data: T) {
        this.data = data;
    }
};