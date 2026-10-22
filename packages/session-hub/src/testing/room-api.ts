/**
 * `SessionHubApi` の Durable Object 版(FakeRoom 経由)。セッション1件に対する操作を、
 * Cloudflare の本番と同じ経路(Worker → DO の RPC)で実行する。通信障害を注入できる。
 */
import type { SessionHubApi } from "../server/session-hub-api-contract";
import type { FakeRoom } from "./fake-room";
import { NetworkError, NO_FAULTS } from "./fake-hub-api";
import type { FakeHubApi, FaultInjector } from "./fake-hub-api";

/** `FakeRoom` に対して、実際のクライアントと同じ API の形で呼べるようにする(テスト用)。 */
export function createRoomApi(
  room: FakeRoom,
  memberId: string | null,
  faults: FaultInjector = NO_FAULTS,
  memberName: string | null = null
): FakeHubApi {
  const calls: Record<string, number> = {};

  const run = async <T>(endpoint: keyof SessionHubApi, args: unknown, exec: () => Promise<T>): Promise<T> => {
    calls[endpoint] = (calls[endpoint] ?? 0) + 1;
    const fault = faults.decide(endpoint, args);
    if (fault === "dropRequest" || fault === "fail") throw new NetworkError(fault === "fail" ? "Service invoked too many times in a short time" : "request dropped");
    if (fault === "duplicate") await exec().catch(() => undefined);
    const result = await exec();
    if (fault === "dropResponse") throw new NetworkError("response dropped");
    return result;
  };

  const operator = (): string => {
    if (!memberId) throw new Error("Unauthorized");
    return memberId;
  };

  const api: SessionHubApi = {
    createSession: () => Promise.reject(new Error("not supported in room api")),
    listSessions: () => Promise.reject(new Error("not supported in room api")),
    closeSession: (args) => run("closeSession", args, async () => {
      operator();
      await room.call("close", {});
    }),
    joinOperator: (args) => run("joinOperator", args, () => room.call("joinOperator", args, operator())),
    setPortalSession: () => Promise.reject(new Error("not supported in room api")),
    // Worker が認証済みのトークンから渡す memberId / 表示名を、本番と同じ経路で DO に渡す
    joinPortal: (args) =>
      run("joinPortal", args, () =>
        room.call("joinPortal", { deviceId: args.deviceId, token: args.token, label: memberName ?? operator() }, operator())
      ),
    poll: (args) => run("poll", args, () => room.call("poll", args)),
    issueCommand: (args) => run("issueCommand", args, () => room.call("issueCommand", args)),
    publishState: (args) => run("publishState", args, () => room.call("publishState", args)),
    openRound: (args) => run("openRound", args, () => room.call("openRound", args)),
    closeRound: (args) => run("closeRound", args, () => room.call("closeRound", args)),
    submitAnswer: (args) => run("submitAnswer", args, () => room.call("submitAnswer", args)),
    getAnswers: (args) => run("getAnswers", args, () => room.call("getAnswers", args)),
    // 結果の保存は DO ではなく R2 / Drive(Worker 側)で扱うので、1セッション分の DO を模すこの API には無い
    putQuizResult: () => Promise.reject(new Error("not supported in room api")),
    getJackpotState: () => Promise.reject(new Error("not supported in room api")),
    ensureJackpotPlan: () => Promise.reject(new Error("not supported in room api")),
    commitJackpotDraw: () => Promise.reject(new Error("not supported in room api")),
    revealJackpotDraw: () => Promise.reject(new Error("not supported in room api")),
    resetJackpot: () => Promise.reject(new Error("not supported in room api")),
    getResults: () => Promise.reject(new Error("not supported in room api")),
    getWebAppUrl: () => Promise.resolve({ url: null }),
  };

  return Object.assign(api, {
    calls,
    total: () => Object.values(calls).reduce((a, b) => a + b, 0),
  });
}
