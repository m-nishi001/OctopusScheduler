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
  }
}

/**
 * 端末ごとの接続を作る。画面(ホスト/管理/ポータル)ごとに1つ作り、破棄時に dispose する。
 * 更新の受け取り方(transport)は既定ではポーリング。
 */
export function createSessionConnection(overrides: Partial<ConnectionOptions> = {}): SessionConnection {
  const api = container.resolve<SessionHubApi>(ISessionHubApiToken);
  return new SessionConnection({
    api,
    store: createBrowserDeviceStore(),
    transport: new PollingTransport(api),
    ...overrides,
  });
}
