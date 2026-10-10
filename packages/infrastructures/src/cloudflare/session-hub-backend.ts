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
import type { ServiceDeps } from "@octopus/session-hub/engine";
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
 * @param kvDeps R2 を使う従来の依存。インデックス(一覧・参加コード)と、作成/終了時のメタ保存に使う。
 */
export function createDoBackend(kvDeps: () => ServiceDeps): SessionHubBackend {
  const kv = (): SessionHubBackend => createKvBackend(kvDeps());
  return {
    async createSession(args, ownerMemberId) {
      const meta = await kv().createSession(args, ownerMemberId);
      await callRoom(meta.id, "init", { meta });
      return meta;
    },
    listSessions: () => kv().listSessions(),
    async closeSession(args) {
      await kv().closeSession(args);
      await callRoom(args.sessionId, "close", {});
    },
    joinOperator: (args, memberId) => callRoom(args.sessionId, "joinOperator", args, memberId) as ReturnType<SessionHubBackend["joinOperator"]>,
    async joinClient(args) {
      const code = (args.code ?? "").trim().toUpperCase();
      if (!code) throw new DomainError("[INVALID_ARGUMENT] 参加コードを入力してください");
      const summary = (await kvDeps().index.list()).find((s) => s.code === code && s.status !== "closed");
      if (!summary) throw new DomainError("[SESSION_NOT_FOUND] 参加コードが見つかりません。コードを確認してください");
      return callRoom(summary.id, "joinClient", args) as ReturnType<SessionHubBackend["joinClient"]>;
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
