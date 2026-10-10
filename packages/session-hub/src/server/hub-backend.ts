/**
 * セッション操作の実行基盤(バックエンド)の抽象。
 *
 * エンドポイント(認可・入出力)は基盤に依存せず、このインターフェースだけを呼ぶ。
 *   - 既定(GAS / ローカル): KV + ロックで実装(createKvBackend)。クライアントはポーリング。
 *   - Cloudflare: セッション1件を1つの Durable Object が担当(直列実行・WebSocket で push)。
 *     Worker 起動時に ISessionHubBackendToken へ登録して差し替える。
 */
import type {
  CloseSessionArgs,
  CreateSessionArgs,
  IssueCommandArgs,
  IssueCommandResult,
  JoinClientArgs,
  JoinOperatorArgs,
  JoinResult,
  PollArgs,
  PollResult,
  PublishStateArgs,
  PublishStateResult,
} from "../shared/protocol";
import type { SessionMeta, SessionSummary } from "../shared/session-types";
import * as service from "./engine/session-service";
import type { ServiceDeps } from "./engine/session-service";

export interface SessionHubBackend {
  createSession(args: CreateSessionArgs, ownerMemberId: string): Promise<SessionMeta>;
  listSessions(): Promise<SessionSummary[]>;
  closeSession(args: CloseSessionArgs): Promise<void>;
  joinOperator(args: JoinOperatorArgs, memberId: string): Promise<JoinResult>;
  joinClient(args: JoinClientArgs): Promise<JoinResult>;
  poll(args: PollArgs): Promise<PollResult>;
  issueCommand(args: IssueCommandArgs): Promise<IssueCommandResult>;
  publishState(args: PublishStateArgs): Promise<PublishStateResult>;
}

export const ISessionHubBackendToken = Symbol("ISessionHubBackend");

/** KV + ロックによる既定のバックエンド。 */
export function createKvBackend(deps: ServiceDeps): SessionHubBackend {
  return {
    createSession: (args, owner) => service.createSession(deps, args, owner),
    listSessions: () => service.listSessions(deps),
    closeSession: (args) => service.closeSession(deps, args),
    joinOperator: (args, memberId) => service.joinOperator(deps, args, memberId),
    joinClient: (args) => service.joinClient(deps, args),
    poll: (args) => service.poll(deps, args),
    issueCommand: (args) => service.issueCommand(deps, args),
    publishState: (args) => service.publishState(deps, args),
  };
}
