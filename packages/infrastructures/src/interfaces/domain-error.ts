/**
 * 入力不正・状態不整合など、リトライしても結果が変わらない業務エラー。
 *
 * エンドポイントの catch で `errorResponse(error)` を使うと `retryable:false` が
 * 付き、クライアント(GAS/Cloudflare の API クライアント)は再試行せずに即座に
 * 失敗として扱う。一時的な障害(タイムアウト・呼び出し過多など)と区別するため、
 * 「受付終了」「無効なトークン」のような想定内の拒否はこのクラスで投げる。
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** エンドポイント共通のエラー応答(JSON文字列)。DomainError は再試行不要を明示する。 */
export function errorResponse(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof DomainError) {
    return JSON.stringify({ status: "error", message, retryable: false });
  }
  return JSON.stringify({ status: "error", message });
}

/**
 * エンドポイントの本体を実行し、成功なら `{ status: "success", data }`、失敗なら `errorResponse` の JSON 文字列にする。
 * 戻り値が無い(undefined)ときの `data` は null。各エンドポイントの try/catch を1か所にまとめるための関数。
 */
export async function respond(run: () => unknown): Promise<string> {
  try {
    const data = await run();
    return JSON.stringify({ status: "success", data: data ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
