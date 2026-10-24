/**
 * セッション層の業務エラーコード。サーバ(`hubError`)が投げ、クライアントが種別で分岐する。
 *
 * コードはエラーメッセージの先頭に `[CODE] ` として埋め込む。Cloudflare の Durable Object
 * 境界を越える例外は name / message しか確実に残らないため、専用フィールドは使わない。
 */
export const HUB_ERROR_CODES = [
  "SESSION_NOT_FOUND",
  "SESSION_CLOSED",
  "DEVICE_UNAUTHORIZED",
  "FORBIDDEN",
  "HOST_ALREADY_CONNECTED",
  "NOT_HOST",
  "INVALID_ARGUMENT",
  "PAYLOAD_TOO_LARGE",
  "TOO_MANY_SESSIONS",
  "ROUND_NOT_OPEN",
  "ROUND_CLOSED",
  "JACKPOT_CONFLICT",
] as const;
export type HubErrorCode = (typeof HUB_ERROR_CODES)[number];

const CODE_PREFIX = /^\[([A-Z_]+)\]\s*/;

/** `[CODE] message` からコードを取り出す。該当しなければ null。 */
export function parseHubErrorCode(message: string): HubErrorCode | null {
  const m = CODE_PREFIX.exec(message);
  if (!m) return null;
  return (HUB_ERROR_CODES as readonly string[]).includes(m[1]) ? (m[1] as HubErrorCode) : null;
}

/** 利用者に見せる文言。先頭の `[CODE] ` を取り除く(無ければそのまま)。 */
export function stripHubErrorCode(message: string): string {
  return message.replace(CODE_PREFIX, "");
}
