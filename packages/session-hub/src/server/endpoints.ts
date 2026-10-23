/**
 * session-hub の GAS / Cloudflare エンドポイント。
 *
 * 各ハンドラは「依存解決 -> sessionService 呼び出し -> ApiResponse に詰めて JSON.stringify」
 * という薄い層のみを担う。認可は次の2層:
 *   - 管理系(作成/一覧/終了/運営者入室/ポータル公開の指定): アカウントの管理者セッション(secure)
 *   - 参加者ポータルへの入室: ログイン済みなら誰でも。メンバーはトークンから確定する(secureMember)
 *   - 端末系(poll/issueCommand/publishState/参加者入室): 入室時に払い出した端末トークン(エンジン内で検証)
 * 端末系は secure("public") で公開し、端末トークンの検証はエンジンが行う。
 */
import { container } from "tsyringe";
import {
  ICacheToken,
  IKeyValueStorageToken,
  ILockToken,
  IUuidGeneratorToken,
  respond,
} from "@octopus/infrastructures/interfaces";
import type { ICache, IKeyValueStorage, ILock, IUuidGenerator } from "@octopus/infrastructures/interfaces";
import { secure, secureAdminWithMember, secureMember } from "@octopus/accounts/secure";
import type {
  CloseRoundArgs,
  GetAnswersArgs,
  ListParticipantsArgs,
  OpenRoundArgs,
  SubmitAnswerArgs,
  CloseSessionArgs,
  CreateSessionArgs,
  CommitJackpotDrawArgs,
  EnsureJackpotPlanArgs,
  GetJackpotStateArgs,
  GetResultsArgs,
  IssueCommandArgs,
  JoinOperatorArgs,
  JoinPortalArgs,
  PollArgs,
  PublishStateArgs,
  PutQuizResultArgs,
  ResetJackpotArgs,
  RevealJackpotDrawArgs,
  SetPortalSessionArgs,
} from "../shared/protocol";
import type { SessionHubEndpointName } from "./session-hub-api-contract";
import { SESSION_HUB_PREFIX } from "./session-hub-api-contract";
import { createCachePresenceStore, createKvSessionIndex, createKvSessionRepo } from "./engine/session-repo";
import { createKvSessionHome } from "./engine/session-service";
import { ISessionHubBackendToken, createKvBackend } from "./hub-backend";
import type { SessionHubBackend } from "./hub-backend";
import type { ServiceDeps } from "./engine/session-service";
import * as results from "./results/results-use-cases";
import type { ResultsDeps } from "./results/results-use-cases";

/** KV + ロック + キャッシュによる実装の依存(GAS の既定、および Cloudflare でも一覧/コード解決に使う)。 */
export function resolveKvDeps(): ServiceDeps {
  const storage = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
  const cache = container.resolve<ICache>(ICacheToken);
  const lock = container.resolve<ILock>(ILockToken);
  const uuid = container.resolve<IUuidGenerator>(IUuidGeneratorToken);
  const now = (): number => Date.now();
  return {
    index: createKvSessionIndex(storage),
    home: createKvSessionHome((id) => createKvSessionRepo(storage, id)),
    repoFor: (id) => createKvSessionRepo(storage, id),
    presenceFor: (id) => createCachePresenceStore(cache, id, now),
    withLock: (key, timeoutMs, fn) => lock.withLock(key, timeoutMs, fn),
    now,
    newId: () => uuid.generate(),
    newToken: () => `${uuid.generate()}${uuid.generate()}`.replace(/-/g, ""),
  };
}

/** 結果の保存(R2 / GAS は Drive)に使う依存。 */
function resolveResultsDeps(): ResultsDeps {
  const storage = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
  const lock = container.resolve<ILock>(ILockToken);
  return { storage, withLock: (key, timeoutMs, fn) => lock.withLock(key, timeoutMs, fn), now: () => Date.now() };
}

/** 登録された基盤(Cloudflare は Durable Object)があればそれを、無ければ KV 実装を使う。 */
function backend(): SessionHubBackend {
  return container.isRegistered(ISessionHubBackendToken)
    ? container.resolve<SessionHubBackend>(ISessionHubBackendToken)
    : createKvBackend(resolveKvDeps());
}

declare let _sessionHub_createSession: (args: CreateSessionArgs) => Promise<string>;
declare let _sessionHub_listSessions: (args?: undefined) => Promise<string>;
declare let _sessionHub_closeSession: (args: CloseSessionArgs) => Promise<string>;
declare let _sessionHub_joinOperator: (args: JoinOperatorArgs) => Promise<string>;
declare let _sessionHub_setPortalSession: (args: SetPortalSessionArgs) => Promise<string>;
declare let _sessionHub_joinPortal: (args: JoinPortalArgs) => Promise<string>;
declare let _sessionHub_poll: (args: PollArgs) => Promise<string>;
declare let _sessionHub_issueCommand: (args: IssueCommandArgs) => Promise<string>;
declare let _sessionHub_publishState: (args: PublishStateArgs) => Promise<string>;
declare let _sessionHub_openRound: (args: OpenRoundArgs) => Promise<string>;
declare let _sessionHub_closeRound: (args: CloseRoundArgs) => Promise<string>;
declare let _sessionHub_submitAnswer: (args: SubmitAnswerArgs) => Promise<string>;
declare let _sessionHub_getAnswers: (args: GetAnswersArgs) => Promise<string>;
declare let _sessionHub_listParticipants: (args: ListParticipantsArgs) => Promise<string>;
declare let _sessionHub_putQuizResult: (args: PutQuizResultArgs) => Promise<string>;
declare let _sessionHub_getJackpotState: (args: GetJackpotStateArgs) => Promise<string>;
declare let _sessionHub_ensureJackpotPlan: (args: EnsureJackpotPlanArgs) => Promise<string>;
declare let _sessionHub_commitJackpotDraw: (args: CommitJackpotDrawArgs) => Promise<string>;
declare let _sessionHub_revealJackpotDraw: (args: RevealJackpotDrawArgs) => Promise<string>;
declare let _sessionHub_resetJackpot: (args: ResetJackpotArgs) => Promise<string>;
declare let _sessionHub_getResults: (args: GetResultsArgs) => Promise<string>;
declare let _sessionHub_getWebAppUrl: () => Promise<string>;

_sessionHub_createSession = secureAdminWithMember(async (args: CreateSessionArgs, member) => {
  return respond(() => backend().createSession(args, member.id));
});

_sessionHub_listSessions = secure("admin", async (): Promise<string> => {
  return respond(() => backend().listSessions());
});

_sessionHub_closeSession = secure("admin", async (args: CloseSessionArgs): Promise<string> => {
  return respond(() => backend().closeSession(args));
});

_sessionHub_joinOperator = secureAdminWithMember(async (args: JoinOperatorArgs, member) => {
  return respond(() => backend().joinOperator(args, member.id));
});

_sessionHub_setPortalSession = secure("admin", async (args: SetPortalSessionArgs): Promise<string> => {
  return respond(() => backend().setPortalSession(args));
});

_sessionHub_joinPortal = secureMember(async (args: JoinPortalArgs, member) => {
  // メンバーIDと表示名はトークンから確定したもの。引数からは deviceId / token(復帰用)だけを受け取る。
  return respond(() => backend().joinPortal({ deviceId: args?.deviceId, token: args?.token }, { id: member.id, name: member.name }));
});

_sessionHub_poll = secure("public", async (args: PollArgs): Promise<string> => {
  return respond(() => backend().poll(args));
});

_sessionHub_issueCommand = secure("public", async (args: IssueCommandArgs): Promise<string> => {
  return respond(() => backend().issueCommand(args));
});

_sessionHub_publishState = secure("public", async (args: PublishStateArgs): Promise<string> => {
  return respond(() => backend().publishState(args));
});

_sessionHub_openRound = secure("public", async (args: OpenRoundArgs): Promise<string> => {
  return respond(() => backend().openRound(args));
});

_sessionHub_closeRound = secure("public", async (args: CloseRoundArgs): Promise<string> => {
  return respond(() => backend().closeRound(args));
});

_sessionHub_submitAnswer = secure("public", async (args: SubmitAnswerArgs): Promise<string> => {
  return respond(() => backend().submitAnswer(args));
});

_sessionHub_getAnswers = secure("public", async (args: GetAnswersArgs): Promise<string> => {
  return respond(() => backend().getAnswers(args));
});

_sessionHub_listParticipants = secure("public", async (args: ListParticipantsArgs): Promise<string> => {
  return respond(() => backend().listParticipants(args));
});

// 結果の書き込みは管理者(= ホスト端末を操作する運営者)のみ。読み取りはログイン済みのメンバーなら誰でも(本人向けに整形)。
_sessionHub_putQuizResult = secure("admin", async (args: PutQuizResultArgs): Promise<string> => {
  return respond(() => results.putQuizResult(resolveResultsDeps(), args?.sessionId, args?.result));
});

_sessionHub_getJackpotState = secure("admin", async (args: GetJackpotStateArgs): Promise<string> => {
  return respond(() => results.getJackpotState(resolveResultsDeps(), args?.sessionId));
});

_sessionHub_ensureJackpotPlan = secure("admin", async (args: EnsureJackpotPlanArgs): Promise<string> => {
  return respond(() => results.ensureJackpotPlan(resolveResultsDeps(), args?.sessionId, args?.plan));
});

_sessionHub_commitJackpotDraw = secure("admin", async (args: CommitJackpotDrawArgs): Promise<string> => {
  return respond(() => results.commitJackpotDraw(resolveResultsDeps(), args?.sessionId, args?.draw));
});

_sessionHub_revealJackpotDraw = secure("admin", async (args: RevealJackpotDrawArgs): Promise<string> => {
  return respond(() => results.revealJackpotDraw(resolveResultsDeps(), args?.sessionId, args?.drawId));
});

_sessionHub_resetJackpot = secure("admin", async (args: ResetJackpotArgs): Promise<string> => {
  return respond(() => results.resetJackpot(resolveResultsDeps(), args?.sessionId));
});

_sessionHub_getResults = secureMember(async (args: GetResultsArgs, member) => {
  return respond(() => results.getResultsFor(resolveResultsDeps(), args?.sessionId, member.id));
});

_sessionHub_getWebAppUrl = secure("public", async (): Promise<string> => {
  return respond(() => {
    // GAS固有(ScriptApp)のためポート化せずここで直接呼ぶ。GAS以外ではnullを返す。
    const url = typeof ScriptApp !== "undefined" ? ScriptApp.getService().getUrl() : null;
    return { url: url || null };
  });
});

/** Cloudflare Worker から直接importして呼び出すためのハンドラ一覧。 */
export const SESSION_HUB_HANDLERS: Record<SessionHubEndpointName, (args: any) => Promise<string>> = {
  createSession: _sessionHub_createSession,
  listSessions: _sessionHub_listSessions,
  closeSession: _sessionHub_closeSession,
  joinOperator: _sessionHub_joinOperator,
  setPortalSession: _sessionHub_setPortalSession,
  joinPortal: _sessionHub_joinPortal,
  poll: _sessionHub_poll,
  issueCommand: _sessionHub_issueCommand,
  publishState: _sessionHub_publishState,
  openRound: _sessionHub_openRound,
  closeRound: _sessionHub_closeRound,
  submitAnswer: _sessionHub_submitAnswer,
  getAnswers: _sessionHub_getAnswers,
  listParticipants: _sessionHub_listParticipants,
  putQuizResult: _sessionHub_putQuizResult,
  getJackpotState: _sessionHub_getJackpotState,
  ensureJackpotPlan: _sessionHub_ensureJackpotPlan,
  commitJackpotDraw: _sessionHub_commitJackpotDraw,
  revealJackpotDraw: _sessionHub_revealJackpotDraw,
  resetJackpot: _sessionHub_resetJackpot,
  getResults: _sessionHub_getResults,
  getWebAppUrl: _sessionHub_getWebAppUrl,
};

export { SESSION_HUB_PREFIX };
