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
import { UIActionEntryToken } from "../../domains/app-event/ui-action-entry-token";
import { TransitionPageAction } from "../../ui/components/settings/app-events/events/transition-page/entry";
import { PlayAudioAction } from "../../ui/components/settings/app-events/events/play-audio/entry";
import { StopAudioAction } from "../../ui/components/settings/app-events/events/stop-audio/entry";
import { SlideshowAction } from "../../ui/components/settings/app-events/events/slideshow/entry";
import { ShowContentAction } from "../../ui/components/settings/app-events/events/show-content/entry";

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
    // register UI action entries so UI can resolve all available actions
    container.register(UIActionEntryToken, { useValue: TransitionPageAction });
    container.register(UIActionEntryToken, { useValue: PlayAudioAction });
    container.register(UIActionEntryToken, { useValue: StopAudioAction });
    container.register(UIActionEntryToken, { useValue: SlideshowAction });
    container.register(UIActionEntryToken, { useValue: ShowContentAction });
  }
}
