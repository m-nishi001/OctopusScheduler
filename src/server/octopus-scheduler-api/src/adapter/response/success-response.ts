/**
 * @typedef {object} SuccessResponse
 * @property {string} status - 処理が成功したことを示します。
 * @property {any} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse {
    status: string = 'success';
    data: any;
    date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    constructor(data: any) {
        this.data = data;
    }
};