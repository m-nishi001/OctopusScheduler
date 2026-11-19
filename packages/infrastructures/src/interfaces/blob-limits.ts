/**
 * ファイル(画像・音声・動画)の送り先が受け付けない条件。クライアントとサーバーが同じ値を使う。
 */

/** 1つのファイルの上限(バイト数)。これを超えるファイルは、何度送っても断られる。 */
export const MAX_BLOB_BYTES = 30 * 1024 * 1024;

/** 上限を MB の文字にする(画面の文言用)。 */
export const MAX_BLOB_MB = MAX_BLOB_BYTES / (1024 * 1024);

/**
 * サーバーがこのファイルを受け付けない(上限超過など)。同じファイルは何度送っても断られるので、再試行しない。
 * 通信の失敗・認証切れ・サーバーの一時的な不調とは違う。
 */
export class BlobRejectedError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "BlobRejectedError";
  }
}

/** 何度送っても同じように断られるエラーか(`BlobRejectedError`、または GAS のサーバーが返す上限超過の文言)。 */
export function isPermanentBlobError(error: unknown): boolean {
  if (error instanceof BlobRejectedError) return true;
  return error instanceof Error && /Blob is too large/.test(error.message);
}
