/**
 * session-hub の GAS/Cloudflare エンドポイント契約(唯一の正準定義)。
 * scripts/gas-contract.js がこのファイルの配列をテキストとして読むため、
 * 配列内にインラインコメントを書かないこと。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";
import type {
  CloseRoundArgs,
  GetAnswersArgs,
  GetAnswersResult,
  OpenRoundArgs,
  OpenRoundResult,
  RoundSummary,
  SubmitAnswerArgs,
  SubmitAnswerResult,
  CloseSessionArgs,
  CreateSessionArgs,
  DeleteJackpotDrawArgs,
  GetResultsArgs,
  IssueCommandArgs,
  IssueCommandResult,
  JoinOperatorArgs,
  JoinPortalArgs,
  JoinResult,
  PollArgs,
  PollResult,
  PublishStateArgs,
  PublishStateResult,
  PutJackpotDrawArgs,
  PutQuizResultArgs,
  ResultsRevResult,
  SetPortalSessionArgs,
} from "../shared/protocol";
import type { ResultsView } from "../shared/results";
import type { SessionMeta, SessionSummary } from "../shared/session-types";

export const SESSION_HUB_PREFIX = "sessionHub" as const;

export const SESSION_HUB_ENDPOINTS = [
  "createSession",
  "listSessions",
  "closeSession",
  "joinOperator",
  "setPortalSession",
  "joinPortal",
  "poll",
  "issueCommand",
  "publishState",
  "openRound",
  "closeRound",
  "submitAnswer",
  "getAnswers",
  "putQuizResult",
  "putJackpotDraw",
  "deleteJackpotDraw",
  "getResults",
  "getWebAppUrl",
] as const;

export type SessionHubEndpointName = (typeof SESSION_HUB_ENDPOINTS)[number];

/** クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` の Proxy の型として使う。 */
export interface SessionHubApi {
  createSession(args: CreateSessionArgs, options?: ApiCallOptions): Promise<SessionMeta>;
  listSessions(args?: undefined, options?: ApiCallOptions): Promise<SessionSummary[]>;
  closeSession(args: CloseSessionArgs, options?: ApiCallOptions): Promise<void>;
  joinOperator(args: JoinOperatorArgs, options?: ApiCallOptions): Promise<JoinResult>;
  /** 参加者ポータルの入口にするセッションを指定する(管理者のみ。同時に1つだけ)。 */
  setPortalSession(args: SetPortalSessionArgs, options?: ApiCallOptions): Promise<void>;
  /** ログイン済みの参加者が、ポータル公開中のセッションに入る。 */
  joinPortal(args: JoinPortalArgs, options?: ApiCallOptions): Promise<JoinResult>;
  poll(args: PollArgs, options?: ApiCallOptions): Promise<PollResult>;
  issueCommand(args: IssueCommandArgs, options?: ApiCallOptions): Promise<IssueCommandResult>;
  publishState(args: PublishStateArgs, options?: ApiCallOptions): Promise<PublishStateResult>;
  openRound(args: OpenRoundArgs, options?: ApiCallOptions): Promise<OpenRoundResult>;
  closeRound(args: CloseRoundArgs, options?: ApiCallOptions): Promise<RoundSummary>;
  submitAnswer(args: SubmitAnswerArgs, options?: ApiCallOptions): Promise<SubmitAnswerResult>;
  getAnswers(args: GetAnswersArgs, options?: ApiCallOptions): Promise<GetAnswersResult>;
  /** クイズ1ラウンドの結果を保存する(管理者のみ)。内容が変わったときだけ rev が進む。 */
  putQuizResult(args: PutQuizResultArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** ジャックポットの抽選結果を1件保存する(管理者のみ)。 */
  putJackpotDraw(args: PutJackpotDrawArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** 抽選結果を取り消す(管理者のみ)。 */
  deleteJackpotDraw(args: DeleteJackpotDrawArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** 結果を、ログイン中のメンバー向けの見せ方で返す(ログイン済みなら誰でも)。 */
  getResults(args: GetResultsArgs, options?: ApiCallOptions): Promise<ResultsView>;
  /** GAS ではデプロイURL(参加者向けQRの基点)。それ以外・取得不可は null。 */
  getWebAppUrl(args?: undefined, options?: ApiCallOptions): Promise<{ url: string | null }>;
}

/** `SessionHubApi` をDI解決するためのトークン。 */
export const ISessionHubApiToken = Symbol("ISessionHubApi");
