/**
 * `SessionHubApi`(クライアントが叩く型付きAPI)のインメモリ実装。TestHub のサービス層を直接呼ぶ。
 *
 * 通信障害を注入できる:
 *   - dropRequest : サーバに届かない(呼び出しは実行されず、クライアントには例外)
 *   - dropResponse: サーバは実行したが応答が届かない(クライアントには例外。再送で重複し得る)
 *   - duplicate   : 同じ呼び出しがサーバで2回実行される(応答は1つ)
 *   - fail        : サーバ側の一時障害(GAS の呼び出し過多など。実行されず例外)
 * 呼び出し回数は `calls` に記録する(リクエスト数の予算テスト用)。
 */
import type { SessionHubApi } from "../server/session-hub-api-contract";
import * as service from "../server/engine/session-service";
import type { TestHub } from "./test-hub";

export type Fault = "ok" | "dropRequest" | "dropResponse" | "duplicate" | "fail";

export interface FaultInjector {
  decide(endpoint: keyof SessionHubApi, args: unknown): Fault;
}

export const NO_FAULTS: FaultInjector = { decide: () => "ok" };

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export interface FakeHubApi extends SessionHubApi {
  /** エンドポイントごとの呼び出し回数(失敗・ドロップも含む。クライアントが発行した数)。 */
  readonly calls: Record<string, number>;
  total(): number;
}

/**
 * @param memberId ログイン中の管理者メンバーID。null なら未ログイン(運営系エンドポイントは Unauthorized)。
 */
export function createFakeHubApi(
  hub: TestHub,
  memberId: string | null,
  faults: FaultInjector = NO_FAULTS
): FakeHubApi {
  const calls: Record<string, number> = {};

  const run = async <T>(
    endpoint: keyof SessionHubApi,
    args: unknown,
    exec: () => Promise<T>
  ): Promise<T> => {
    calls[endpoint] = (calls[endpoint] ?? 0) + 1;
    const fault = faults.decide(endpoint, args);
    if (fault === "dropRequest") throw new NetworkError("request dropped");
    if (fault === "fail") throw new NetworkError("Service invoked too many times in a short time");
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
    createSession: (args) => run("createSession", args, () => service.createSession(hub.deps, args, operator())),
    listSessions: () => run("listSessions", undefined, async () => {
      operator();
      return service.listSessions(hub.deps);
    }),
    closeSession: (args) => run("closeSession", args, async () => {
      operator();
      await service.closeSession(hub.deps, args);
    }),
    joinOperator: (args) => run("joinOperator", args, () => service.joinOperator(hub.deps, args, operator())),
    joinClient: (args) => run("joinClient", args, () => service.joinClient(hub.deps, args)),
    poll: (args) => run("poll", args, () => service.poll(hub.deps, args)),
    issueCommand: (args) => run("issueCommand", args, () => service.issueCommand(hub.deps, args)),
    publishState: (args) => run("publishState", args, () => service.publishState(hub.deps, args)),
  };

  return Object.assign(api, {
    calls,
    total: () => Object.values(calls).reduce((a, b) => a + b, 0),
  });
}

/** 再現性のある乱数(mulberry32)。シミュレータのフォールトスケジュール用。 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 確率でフォールトを選ぶインジェクタ。 */
export function randomFaults(
  rand: () => number,
  rates: Partial<Record<Exclude<Fault, "ok">, number>>
): FaultInjector {
  return {
    decide() {
      const r = rand();
      let acc = 0;
      for (const [fault, rate] of Object.entries(rates) as [Exclude<Fault, "ok">, number][]) {
        acc += rate;
        if (r < acc) return fault;
      }
      return "ok";
    },
  };
}
