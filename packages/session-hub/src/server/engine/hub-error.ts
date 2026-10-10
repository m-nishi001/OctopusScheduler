import { DomainError } from "@octopus/infrastructures/interfaces";

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
] as const;
export type HubErrorCode = (typeof HUB_ERROR_CODES)[number];

/**
 * セッション層の業務エラー。メッセージ先頭に `[CODE]` を付け、クライアントが
 * 種別で分岐できるようにする(GAS/Cloudflare の応答に専用フィールドを足さないため)。
 * DomainError なので再試行されない。
 */
export function hubError(code: HubErrorCode, message: string): DomainError {
  return new DomainError(`[${code}] ${message}`);
}

/** `[CODE] message` からコードを取り出す。該当しなければ null。 */
export function parseHubErrorCode(message: string): HubErrorCode | null {
  const m = /^\[([A-Z_]+)\]/.exec(message);
  if (!m) return null;
  return (HUB_ERROR_CODES as readonly string[]).includes(m[1]) ? (m[1] as HubErrorCode) : null;
}
