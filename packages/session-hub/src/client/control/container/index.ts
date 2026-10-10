import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import {
  ISessionHubApiToken,
  SESSION_HUB_ENDPOINTS,
  SESSION_HUB_PREFIX,
} from "../../../server/session-hub-api-contract";
import type { SessionHubApi } from "../../../server/session-hub-api-contract";
import { createBrowserDeviceStore } from "../../model/device-store";
import { PollingTransport } from "../../model/polling-transport";
import { DEFAULT_WS_OPTIONS, WebSocketTransport } from "../../model/websocket-transport";
import type { WebSocketLike } from "../../model/websocket-transport";
import type { SessionTransport } from "../../model/transport";
import { HostAgent } from "../../model/host-agent";
import { SessionAdminRepository } from "../../model/session-admin-repository";
import { SessionConnection } from "../../model/session-connection";
import type { ConnectionOptions } from "../../model/session-connection";

export class Container {
  static register(): void {
    // IApiClientToken は他機能の Container も同じ実装を登録する(同じ解決結果なので上書きして問題ない)。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
    container.register<SessionHubApi>(ISessionHubApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<SessionHubApi>(
          c.resolve(IApiClientToken),
          SESSION_HUB_PREFIX,
          SESSION_HUB_ENDPOINTS
        )
      ),
    });
    container.register(SessionAdminRepository, {
      useFactory: instanceCachingFactory((c) => new SessionAdminRepository(c.resolve<SessionHubApi>(ISessionHubApiToken))),
    });
    // ホストのエージェントはアプリ全体で1つ(画面遷移を跨いで接続を保つため)。
    container.register(HostAgent, {
      useFactory: instanceCachingFactory(() => new HostAgent(createSessionConnection())),
    });
  }
}

/**
 * 実行環境に合った更新の受け取り方を選ぶ。
 *   - GAS(google.script.run あり): ポーリング(WebSocket は使えない。人数は GAS 側のクォータで決まる)
 *   - それ以外(Cloudflare): WebSocket。繋がらなければ低頻度ポーリングに自動で切り替える
 */
export function createDefaultTransport(api: SessionHubApi): SessionTransport {
  const polling = new PollingTransport(api);
  const g = globalThis as { google?: { script?: { run?: unknown } }; WebSocket?: new (url: string) => WebSocketLike; location?: Location };
  const isGas = !!g.google?.script?.run;
  if (isGas || typeof g.WebSocket !== "function" || !g.location) return polling;
  const { protocol, host } = g.location;
  const WS = g.WebSocket;
  return new WebSocketTransport({
    ...DEFAULT_WS_OPTIONS,
    url: (sessionId) => `${protocol === "https:" ? "wss:" : "ws:"}//${host}/ws/${encodeURIComponent(sessionId)}`,
    createSocket: (url) => new WS(url),
    fallback: polling,
  });
}

/**
 * 端末ごとの接続を作る。画面(ホスト/管理/ポータル)ごとに1つ作り、破棄時に dispose する。
 */
export function createSessionConnection(overrides: Partial<ConnectionOptions> = {}): SessionConnection {
  const api = container.resolve<SessionHubApi>(ISessionHubApiToken);
  return new SessionConnection({
    api,
    store: createBrowserDeviceStore(),
    transport: createDefaultTransport(api),
    ...overrides,
  });
}
