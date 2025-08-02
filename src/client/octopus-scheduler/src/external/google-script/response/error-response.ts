/**
 * @typedef {object} ErrorResponse
 * @property {string} status - 個々のGAS関数呼び出し試行中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export class ErrorResponse {
    public readonly status: string = 'error';
    public readonly message: string;
    constructor(message: string) {
        this.message = message;
    }
}