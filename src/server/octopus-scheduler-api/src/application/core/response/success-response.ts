/**
 * @typedef {object} SuccessResponse
 * @property {'success'} status - 処理が成功したことを示します。
 * @property {T} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse<T> {
    status: string = 'success';
    data: T;
    date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    constructor(data: T) {
        this.data = data;
    }
};