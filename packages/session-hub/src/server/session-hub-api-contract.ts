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
  ListParticipantsArgs,
  ListParticipantsResult,
  OpenRoundArgs,
  OpenRoundResult,
  RoundSummary,
  SubmitAnswerArgs,
  SubmitAnswerResult,
  CloseSessionArgs,
  CreateSessionArgs,
  CommitJackpotDrawArgs,
  EnsureJackpotPlanArgs,
  EnsureJackpotPlanResult,
  GetJackpotStateArgs,
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
  PutQuizResultArgs,
  ResetJackpotArgs,
  ResultsRevResult,
  RevealJackpotDrawArgs,
  SetPortalSessionArgs,
} from "../shared/protocol";
import type { JackpotState, ResultsView } from "../shared/results";
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
  "listParticipants",
  "putQuizResult",
  "getJackpotState",
  "ensureJackpotPlan",
  "commitJackpotDraw",
  "revealJackpotDraw",
  "resetJackpot",
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
  /** ホスト/管理: このセッションにポータルから入室したメンバーのID一覧を取得する。 */
  listParticipants(args: ListParticipantsArgs, options?: ApiCallOptions): Promise<ListParticipantsResult>;
  /** クイズ1ラウンドの結果を保存する(管理者のみ)。内容が変わったときだけ rev が進む。 */
  putQuizResult(args: PutQuizResultArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** ジャックポットの抽選状態(未公開の行を含む全件・確変の予定・rev)を返す(管理者のみ)。 */
  getJackpotState(args: GetJackpotStateArgs, options?: ApiCallOptions): Promise<JackpotState>;
  /** 確変の予定を、まだ無ければ保存する。返るのは保存されている予定(並行して呼ばれても先に保存されたものが勝つ)。管理者のみ。 */
  ensureJackpotPlan(args: EnsureJackpotPlanArgs, options?: ApiCallOptions): Promise<EnsureJackpotPlanResult>;
  /** 抽選結果を未公開で確定する(管理者のみ)。矛盾すれば JACKPOT_CONFLICT。同じ内容の再送は成功。rev は進まない。 */
  commitJackpotDraw(args: CommitJackpotDrawArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** 確定済みの抽選を公開する(管理者のみ)。何度呼んでも同じ。公開で rev が進む。 */
  revealJackpotDraw(args: RevealJackpotDrawArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** 抽選の結果と確変の予定を消す(管理者のみ。クイズの結果はそのまま)。 */
  resetJackpot(args: ResetJackpotArgs, options?: ApiCallOptions): Promise<ResultsRevResult>;
  /** 結果を、ログイン中のメンバー向けの見せ方で返す(ログイン済みなら誰でも)。 */
  getResults(args: GetResultsArgs, options?: ApiCallOptions): Promise<ResultsView>;
  /** GAS ではデプロイURL(参加者向けQRの基点)。それ以外・取得不可は null。 */
  getWebAppUrl(args?: undefined, options?: ApiCallOptions): Promise<{ url: string | null }>;
}

/** `SessionHubApi` をDI解決するためのトークン。 */
export const ISessionHubApiToken = Symbol("ISessionHubApi");
