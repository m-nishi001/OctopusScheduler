import {
  IApiClientToken,
  IConcurrencyPolicyToken,
  createTypedApiClient,
} from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import { PlatformConcurrencyPolicy } from "@octopus/infrastructures/platform-concurrency-policy";
import { SyncRunner } from "@octopus/sync-engine";
import {
  OCTOPUS_SCHEDULER_PREFIX,
  OCTOPUS_SCHEDULER_ENDPOINTS,
  OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS,
  IOctopusSchedulerApiToken,
} from "../../../server/scheduler-api-contract";
import type { OctopusSchedulerApi } from "../../../server/scheduler-api-contract";
import { AppEventRepository } from "@model/app-event/app-event-repository";
import { AssetRepository } from "../../model/asset/asset-repository";
import { container, instanceCachingFactory } from "tsyringe";
import { AppEventService } from "../app-event/app-event-service";
import { AssetService } from "../asset/asset-service";
import { SyncService } from "../sync/sync-service";
import { AssetSource } from "../media/asset-source";
import { AudioControl, AudioServiceToken } from "../media/audio";
import { LobbyPathToken, ScreenControl } from "../media/screen";
import { AudioService } from "@octopus/client-common/audio/audio-service";
import { HostAgent } from "@octopus/session-hub";

/** アプリの依存の登録。ビルド対象(GAS / Cloudflare)ごとの API クライアントなど、環境で変わるものをここで結ぶ。 */
export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
    // 同期エンジンの並列度も同じ仕組みで環境ごとに切り替える。
    container.register(IConcurrencyPolicyToken, {
      useClass: PlatformConcurrencyPolicy,
    });
    container.register<OctopusSchedulerApi>(IOctopusSchedulerApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<OctopusSchedulerApi>(
          c.resolve(IApiClientToken),
          OCTOPUS_SCHEDULER_PREFIX,
          OCTOPUS_SCHEDULER_ENDPOINTS.filter(
            (name): name is keyof OctopusSchedulerApi & string =>
              !(OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS as readonly string[]).includes(name)
          )
        )
      ),
    });

    container.register(AssetRepository, { useClass: AssetRepository });
    container.register(AppEventRepository, { useClass: AppEventRepository });

    container.register(AssetService, { useClass: AssetService });
    container.register(AppEventService, { useClass: AppEventService });
    // メディア(音楽・スクリーン)。ルーター(`ScreenRouterToken`)は、作ったあとに `main.ts` が登録する。
    container.registerSingleton(AssetSource);
    container.register(AudioServiceToken, { useFactory: instanceCachingFactory(() => new AudioService()) });
    container.registerSingleton(AudioControl);
    container.register(LobbyPathToken, {
      useValue: () => (container.isRegistered(HostAgent) ? container.resolve(HostAgent).lobbyPath : null),
    });
    container.registerSingleton(ScreenControl);
    container.register(SyncRunner, { useClass: SyncRunner });
    container.register(SyncService, { useClass: SyncService });
  }
}
