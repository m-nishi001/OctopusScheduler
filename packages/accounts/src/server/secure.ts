/**
 * サーバーエンドポイントの認可ラッパー。
 *
 * 全ハンドラを `secure(policy, handler)` で包む。ポリシーは次の2つ:
 *   - "public": 誰でも呼べる(トークンがあっても検証しない)
 *   - "admin" : 本番モードでは有効な管理者セッションが必須。開発モードでは素通し。
 * どちらの場合も、クライアントが相乗りさせたトークンのエンベロープは外してから
 * ハンドラへ渡す(ハンドラは認証を意識しない)。
 */
import { container } from "tsyringe";
import { IKeyValueStorageToken, unwrapAuth } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { getSession } from "./accounts-use-cases";

export type EndpointPolicy = "public" | "admin";

declare const __APP_MODE__: "development" | "production";

/** ビルド時に app-mode.config.json から埋め込まれたモードが本番か。 */
export function isProductionMode(): boolean {
  return __APP_MODE__ === "production";
}

/** クライアントはリトライせず即座に失敗として扱う(retryable:false)。 */
export const UNAUTHORIZED_RESPONSE = JSON.stringify({
  status: "error",
  message: "Unauthorized",
  retryable: false,
});

export interface SecureDeps {
  isProduction: () => boolean;
  getStorage: () => IKeyValueStorage;
  now: () => number;
}

type Handler = (args?: any) => Promise<string>;

export function createSecure(deps: SecureDeps) {
  return function secure<H extends Handler>(policy: EndpointPolicy, handler: H): H {
    return (async (raw?: unknown): Promise<string> => {
      const { token, args } = unwrapAuth(raw);
      if (policy === "admin" && deps.isProduction()) {
        const member = await getSession({ storage: deps.getStorage(), now: deps.now }, token ?? "");
        if (!member?.isAdmin) return UNAUTHORIZED_RESPONSE;
      }
      return handler(args);
    }) as H;
  };
}

export const secure = createSecure({
  isProduction: isProductionMode,
  getStorage: () => container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
  now: () => Date.now(),
});
