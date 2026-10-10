/**
 * session-hub の GAS / Cloudflare エンドポイント。
 *
 * 各ハンドラは「依存解決 -> sessionService 呼び出し -> ApiResponse に詰めて JSON.stringify」
 * という薄い層のみを担う。認可は次の2層:
 *   - 管理系(作成/一覧/終了/運営者入室): アカウントの管理者セッション(secure)
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
import { secure, secureAdminWithMember } from "@octopus/accounts/secure";
import type {
  CloseRoundArgs,
  GetAnswersArgs,
  OpenRoundArgs,
  SubmitAnswerArgs,
  CloseSessionArgs,
  CreateSessionArgs,
  IssueCommandArgs,
  JoinClientArgs,
  JoinOperatorArgs,
  PollArgs,
  PublishStateArgs,
} from "../shared/protocol";
import type { SessionHubEndpointName } from "./session-hub-api-contract";
import { SESSION_HUB_PREFIX } from "./session-hub-api-contract";
import { createCachePresenceStore, createKvSessionIndex, createKvSessionRepo } from "./engine/session-repo";
import { ISessionHubBackendToken, createKvBackend } from "./hub-backend";
import type { SessionHubBackend } from "./hub-backend";
import type { ServiceDeps } from "./engine/session-service";

/** KV + ロック + キャッシュによる実装の依存(GAS の既定、および Cloudflare でも一覧/コード解決に使う)。 */
export function resolveKvDeps(): ServiceDeps {
  const storage = container.resolve<IKeyValueStorage>(IKeyValueStorageToken);
  const cache = container.resolve<ICache>(ICacheToken);
  const lock = container.resolve<ILock>(ILockToken);
  const uuid = container.resolve<IUuidGenerator>(IUuidGeneratorToken);
  const now = (): number => Date.now();
  return {
    index: createKvSessionIndex(storage),
    repoFor: (id) => createKvSessionRepo(storage, id),
    presenceFor: (id) => createCachePresenceStore(cache, id, now),
    withLock: (key, timeoutMs, fn) => lock.withLock(key, timeoutMs, fn),
    now,
    newId: () => uuid.generate(),
    newToken: () => `${uuid.generate()}${uuid.generate()}`.replace(/-/g, ""),
  };
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
declare let _sessionHub_joinClient: (args: JoinClientArgs) => Promise<string>;
declare let _sessionHub_poll: (args: PollArgs) => Promise<string>;
declare let _sessionHub_issueCommand: (args: IssueCommandArgs) => Promise<string>;
declare let _sessionHub_publishState: (args: PublishStateArgs) => Promise<string>;
declare let _sessionHub_openRound: (args: OpenRoundArgs) => Promise<string>;
declare let _sessionHub_closeRound: (args: CloseRoundArgs) => Promise<string>;
declare let _sessionHub_submitAnswer: (args: SubmitAnswerArgs) => Promise<string>;
declare let _sessionHub_getAnswers: (args: GetAnswersArgs) => Promise<string>;
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

_sessionHub_joinClient = secure("public", async (args: JoinClientArgs): Promise<string> => {
  try {
    return ok(await backend().joinClient(args));
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
  joinClient: _sessionHub_joinClient,
  poll: _sessionHub_poll,
  issueCommand: _sessionHub_issueCommand,
  publishState: _sessionHub_publishState,
  openRound: _sessionHub_openRound,
  closeRound: _sessionHub_closeRound,
  submitAnswer: _sessionHub_submitAnswer,
  getAnswers: _sessionHub_getAnswers,
  getWebAppUrl: _sessionHub_getWebAppUrl,
};

export { SESSION_HUB_PREFIX };
