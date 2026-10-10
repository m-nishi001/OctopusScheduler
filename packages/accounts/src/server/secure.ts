/**
 * サーバーエンドポイントの認可ラッパー。
 *
 * 全ハンドラを `secure(policy, handler)` で包む。ポリシーは次の2つ:
 *   - "public": 誰でも呼べる(トークンがあっても検証しない)
 *   - "admin" : 有効な管理者セッションが必須。
 * どちらの場合も、クライアントが相乗りさせたトークンのエンベロープは外してから
 * ハンドラへ渡す(ハンドラは認証を意識しない)。
 */
import { container } from "tsyringe";
import { IKeyValueStorageToken, unwrapAuth } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { getSession } from "./accounts-use-cases";
import type { Member } from "./accounts-api-contract";

export type EndpointPolicy = "public" | "admin";

/** クライアントはリトライせず即座に失敗として扱う(retryable:false)。 */
export const UNAUTHORIZED_RESPONSE = JSON.stringify({
  status: "error",
  message: "Unauthorized",
  retryable: false,
});

export interface SecureDeps {
  getStorage: () => IKeyValueStorage;
  now: () => number;
}

type Handler = (args?: any) => Promise<string>;

export function createSecure(deps: SecureDeps) {
  return function secure<H extends Handler>(policy: EndpointPolicy, handler: H): H {
    return (async (raw?: unknown): Promise<string> => {
      const { token, args } = unwrapAuth(raw);
      if (policy === "admin") {
        const member = await getSession({ storage: deps.getStorage(), now: deps.now }, token ?? "");
        if (!member?.isAdmin) return UNAUTHORIZED_RESPONSE;
      }
      return handler(args);
    }) as H;
  };
}

type MemberHandler = (args: any, member: Member) => Promise<string>;

/**
 * `secure("admin", ...)` の亜種。ハンドラへ認証済みの管理者メンバーも渡す
 * (「誰の端末か」を記録したい操作、例: セッション作成者・ホスト端末の起動者)。
 * 管理者として検証できない場合は常に Unauthorized。
 */
export function createSecureAdminWithMember(deps: SecureDeps) {
  return function secureAdminWithMember<H extends MemberHandler>(handler: H): (raw?: unknown) => Promise<string> {
    return async (raw?: unknown): Promise<string> => {
      const { token, args } = unwrapAuth(raw);
      const member = await getSession({ storage: deps.getStorage(), now: deps.now }, token ?? "");
      if (!member?.isAdmin) return UNAUTHORIZED_RESPONSE;
      return handler(args, member);
    };
  };
}

const deps: SecureDeps = {
  getStorage: () => container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
  now: () => Date.now(),
};

export const secure = createSecure(deps);
export const secureAdminWithMember = createSecureAdminWithMember(deps);
