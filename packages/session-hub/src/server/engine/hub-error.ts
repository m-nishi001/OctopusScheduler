import { DomainError } from "@octopus/infrastructures/interfaces";
import type { HubErrorCode } from "../../shared/hub-error";

/**
 * セッション層の業務エラー。メッセージ先頭に `[CODE]` を付け、クライアントが
 * 種別で分岐できるようにする(コードの扱いは shared/hub-error.ts)。
 * DomainError なので再試行されない。
 */
export function hubError(code: HubErrorCode, message: string): DomainError {
  return new DomainError(`[${code}] ${message}`);
}
