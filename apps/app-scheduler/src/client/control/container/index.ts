import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
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
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcutService } from "../keyboard-shortcut/keyboard-shortcut-service";

export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
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
    container.register(KeyboardShortcutRepository, {
      useClass: KeyboardShortcutRepository,
    });
    container.register(KeyboardShortcutService, {
      useClass: KeyboardShortcutService,
    });
  }
}
