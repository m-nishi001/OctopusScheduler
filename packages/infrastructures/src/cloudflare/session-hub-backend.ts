/**
 * Cloudflare 用の session-hub バックエンド。セッション1件の操作は Durable Object(SessionRoom)へ
 * 転送する。作成・一覧・参加コードの解決だけは(全セッション共通のため)R2 のインデックスを使う。
 *
 * 呼び出しごとに Worker 1 + DO 1 のリクエストが課金される。参加者数百人の更新は
 * WebSocket の push(クライアントはポーリングしない)で賄い、RPC は入室・運営の操作に限る。
 */
import { DomainError } from "../interfaces/domain-error";
import type { RoomOp, RoomRpcResult } from "@octopus/session-hub/room";
import type { SessionHubBackend } from "@octopus/session-hub/backend";
import { createKvBackend } from "@octopus/session-hub/backend";
import type { ServiceDeps, SessionHome } from "@octopus/session-hub/engine";
import { currentEnv } from "./request-context";

export interface SessionRoomNamespaceEnv {
  SESSION_ROOM: DurableObjectNamespace;
}

async function callRoom(sessionId: string, op: RoomOp, args: unknown, memberId?: string): Promise<unknown> {
  if (!sessionId || typeof sessionId !== "string") throw new DomainError("[INVALID_ARGUMENT] sessionId が必要です");
  const ns = (currentEnv() as unknown as SessionRoomNamespaceEnv).SESSION_ROOM;
  const stub = ns.get(ns.idFromName(sessionId));
  const res = await stub.fetch("https://session-room/rpc", {
    method: "POST",
    body: JSON.stringify({ op, args, memberId }),
  });
  const result = (await res.json()) as RoomRpcResult;
  if (!result.ok) throw new DomainError(result.message);
  return result.data;
}

/**
 * セッション本体の置き場としての Durable Object。メタ情報は DO だけが持つ（R2 に二重に持たない）。
 * 作成・終了は idempotent なので、失敗しても同じ操作をやり直せる。
 */
const durableObjectHome: SessionHome = {
  create: async (meta) => void (await callRoom(meta.id, "init", { meta })),
  close: async (sessionId) => void (await callRoom(sessionId, "close", {})),
};

/**
 * @param kvDeps R2 の一覧（全セッション共通のインデックス）を含む依存。セッション本体の置き場は Durable Object に差し替える。
 *               一覧への追加・削除は、DO への操作が成功してから行う（{@link SessionHome}）。
 */
export function createDoBackend(kvDeps: () => ServiceDeps): SessionHubBackend {
  const kv = (): SessionHubBackend => createKvBackend({ ...kvDeps(), home: durableObjectHome });
  return {
    createSession: (args, ownerMemberId) => kv().createSession(args, ownerMemberId),
    listSessions: () => kv().listSessions(),
    closeSession: (args) => kv().closeSession(args),
    joinOperator: (args, memberId) => callRoom(args.sessionId, "joinOperator", args, memberId) as ReturnType<SessionHubBackend["joinOperator"]>,
    // 公開の指定は一覧のインデックスだけを書き換える(Durable Object は触らない)
    setPortalSession: (args) => kv().setPortalSession(args),
    async joinPortal(args, member) {
      const summary = (await kv().listSessions()).find((s) => s.portal === true && s.status !== "closed");
      if (!summary) throw new DomainError("[SESSION_NOT_FOUND] いま参加できるイベントはありません");
      return callRoom(
        summary.id,
        "joinPortal",
        { deviceId: args.deviceId, token: args.token, label: member.name },
        member.id
      ) as ReturnType<SessionHubBackend["joinPortal"]>;
    },
    poll: (args) => callRoom(args.sessionId, "poll", args) as ReturnType<SessionHubBackend["poll"]>,
    issueCommand: (args) => callRoom(args.sessionId, "issueCommand", args) as ReturnType<SessionHubBackend["issueCommand"]>,
    publishState: (args) => callRoom(args.sessionId, "publishState", args) as ReturnType<SessionHubBackend["publishState"]>,
    openRound: (args) => callRoom(args.sessionId, "openRound", args) as ReturnType<SessionHubBackend["openRound"]>,
    closeRound: (args) => callRoom(args.sessionId, "closeRound", args) as ReturnType<SessionHubBackend["closeRound"]>,
    submitAnswer: (args) => callRoom(args.sessionId, "submitAnswer", args) as ReturnType<SessionHubBackend["submitAnswer"]>,
    getAnswers: (args) => callRoom(args.sessionId, "getAnswers", args) as ReturnType<SessionHubBackend["getAnswers"]>,
  };
}
