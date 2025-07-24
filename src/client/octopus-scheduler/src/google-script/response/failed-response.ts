/**
 * @typedef {object} FailedResponse
 * @property {string} status - 処理がリトライ上限に達しても成功しなかったことを示します。
 * @property {string} message - 最終的な失敗メッセージ。
 */
export class FailedResponse {
    public readonly status: string = 'failed';
    public readonly message: string;
    constructor(message: string) {
        this.message = message;
    }
}