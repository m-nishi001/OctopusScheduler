/**
 * @typedef {object} ErrorResponse
 * @property {string} status - 処理中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export class ErrorResponse {
    status: string = 'error';
    message: string;
    date: string = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    constructor(message: string) {
        this.message = message;
    }
};