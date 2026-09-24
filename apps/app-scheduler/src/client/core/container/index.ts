import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
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
import { AppEventService } from "../../control/app-event/app-event-service";
import { AssetService } from "../../control/asset/asset-service";
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcutService } from "../../control/keyboard-shortcut/keyboard-shortcut-service";

export class Container {
  static Register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });
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
