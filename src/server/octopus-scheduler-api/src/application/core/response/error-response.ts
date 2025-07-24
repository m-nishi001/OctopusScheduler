/**
 * @typedef {object} ErrorResponse
 * @property {'error'} status - 処理中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export class ErrorResponse {
    status: string = 'error';
    message: string;

    constructor(message: string) {
        this.message = message;
    }
};