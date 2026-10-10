/**
 * session-hub の GAS/Cloudflare エンドポイント契約(唯一の正準定義)。
 * scripts/gas-contract.js がこのファイルの配列をテキストとして読むため、
 * 配列内にインラインコメントを書かないこと。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
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

export const SESSION_HUB_PREFIX = "sessionHub" as const;

export const SESSION_HUB_ENDPOINTS = [
  "createSession",
  "listSessions",
  "closeSession",
  "joinOperator",
  "joinClient",
  "poll",
  "issueCommand",
  "publishState",
] as const;

export type SessionHubEndpointName = (typeof SESSION_HUB_ENDPOINTS)[number];

/** クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` の Proxy の型として使う。 */
export interface SessionHubApi {
  createSession(args: CreateSessionArgs, options?: ApiCallOptions): Promise<SessionMeta>;
  listSessions(args?: undefined, options?: ApiCallOptions): Promise<SessionSummary[]>;
  closeSession(args: CloseSessionArgs, options?: ApiCallOptions): Promise<void>;
  joinOperator(args: JoinOperatorArgs, options?: ApiCallOptions): Promise<JoinResult>;
  joinClient(args: JoinClientArgs, options?: ApiCallOptions): Promise<JoinResult>;
  poll(args: PollArgs, options?: ApiCallOptions): Promise<PollResult>;
  issueCommand(args: IssueCommandArgs, options?: ApiCallOptions): Promise<IssueCommandResult>;
  publishState(args: PublishStateArgs, options?: ApiCallOptions): Promise<PublishStateResult>;
}

/** `SessionHubApi` をDI解決するためのトークン。 */
export const ISessionHubApiToken = Symbol("ISessionHubApi");
