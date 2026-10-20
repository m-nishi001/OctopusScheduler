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
  errorResponse,
} from "@octopus/infrastructures/interfaces";
import type { ICache, IKeyValueStorage, ILock, IUuidGenerator } from "@octopus/infrastructures/interfaces";
import { secure, secureAdminWithMember, secureMember } from "@octopus/accounts/secure";
import type {
  CloseRoundArgs,
  GetAnswersArgs,
  OpenRoundArgs,
  SubmitAnswerArgs,
  CloseSessionArgs,
  CreateSessionArgs,
  DeleteJackpotDrawArgs,
  GetResultsArgs,
  IssueCommandArgs,
  JoinOperatorArgs,
  JoinPortalArgs,
  PollArgs,
  PublishStateArgs,
  PutJackpotDrawArgs,
  PutQuizResultArgs,
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

const ok = (data: unknown): string => JSON.stringify({ status: "success", data });

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
declare let _sessionHub_putQuizResult: (args: PutQuizResultArgs) => Promise<string>;
declare let _sessionHub_putJackpotDraw: (args: PutJackpotDrawArgs) => Promise<string>;
declare let _sessionHub_deleteJackpotDraw: (args: DeleteJackpotDrawArgs) => Promise<string>;
declare let _sessionHub_getResults: (args: GetResultsArgs) => Promise<string>;
declare let _sessionHub_getWebAppUrl: () => Promise<string>;

_sessionHub_createSession = secureAdminWithMember(async (args: CreateSessionArgs, member) => {
  try {
    return ok(await backend().createSession(args, member.id));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_listSessions = secure("admin", async (): Promise<string> => {
  try {
    return ok(await backend().listSessions());
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_closeSession = secure("admin", async (args: CloseSessionArgs): Promise<string> => {
  try {
    await backend().closeSession(args);
    return ok(null);
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_joinOperator = secureAdminWithMember(async (args: JoinOperatorArgs, member) => {
  try {
    return ok(await backend().joinOperator(args, member.id));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_setPortalSession = secure("admin", async (args: SetPortalSessionArgs): Promise<string> => {
  try {
    await backend().setPortalSession(args);
    return ok(null);
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_joinPortal = secureMember(async (args: JoinPortalArgs, member) => {
  try {
    // メンバーIDと表示名はトークンから確定したもの。引数からは deviceId / token(復帰用)だけを受け取る。
    return ok(await backend().joinPortal({ deviceId: args?.deviceId, token: args?.token }, { id: member.id, name: member.name }));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_poll = secure("public", async (args: PollArgs): Promise<string> => {
  try {
    return ok(await backend().poll(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_issueCommand = secure("public", async (args: IssueCommandArgs): Promise<string> => {
  try {
    return ok(await backend().issueCommand(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_publishState = secure("public", async (args: PublishStateArgs): Promise<string> => {
  try {
    return ok(await backend().publishState(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_openRound = secure("public", async (args: OpenRoundArgs): Promise<string> => {
  try {
    return ok(await backend().openRound(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_closeRound = secure("public", async (args: CloseRoundArgs): Promise<string> => {
  try {
    return ok(await backend().closeRound(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_submitAnswer = secure("public", async (args: SubmitAnswerArgs): Promise<string> => {
  try {
    return ok(await backend().submitAnswer(args));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_getAnswers = secure("public", async (args: GetAnswersArgs): Promise<string> => {
  try {
    return ok(await backend().getAnswers(args));
  } catch (error) {
    return errorResponse(error);
  }
});

// 結果の書き込みは管理者(= ホスト端末を操作する運営者)のみ。読み取りはログイン済みのメンバーなら誰でも(本人向けに整形)。
_sessionHub_putQuizResult = secure("admin", async (args: PutQuizResultArgs): Promise<string> => {
  try {
    return ok(await results.putQuizResult(resolveResultsDeps(), args?.sessionId, args?.result));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_putJackpotDraw = secure("admin", async (args: PutJackpotDrawArgs): Promise<string> => {
  try {
    return ok(await results.putJackpotDraw(resolveResultsDeps(), args?.sessionId, args?.draw));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_deleteJackpotDraw = secure("admin", async (args: DeleteJackpotDrawArgs): Promise<string> => {
  try {
    return ok(await results.deleteJackpotDraw(resolveResultsDeps(), args?.sessionId, args?.drawId));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_getResults = secureMember(async (args: GetResultsArgs, member) => {
  try {
    return ok(await results.getResultsFor(resolveResultsDeps(), args?.sessionId, member.id));
  } catch (error) {
    return errorResponse(error);
  }
});

_sessionHub_getWebAppUrl = secure("public", async (): Promise<string> => {
  try {
    // GAS固有(ScriptApp)のためポート化せずここで直接呼ぶ。GAS以外ではnullを返す。
    const url = typeof ScriptApp !== "undefined" ? ScriptApp.getService().getUrl() : null;
    return ok({ url: url || null });
  } catch (error) {
    return errorResponse(error);
  }
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
  putQuizResult: _sessionHub_putQuizResult,
  putJackpotDraw: _sessionHub_putJackpotDraw,
  deleteJackpotDraw: _sessionHub_deleteJackpotDraw,
  getResults: _sessionHub_getResults,
  getWebAppUrl: _sessionHub_getWebAppUrl,
};

export { SESSION_HUB_PREFIX };
