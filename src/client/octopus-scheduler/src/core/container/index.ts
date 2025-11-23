import { AppEventRepository } from "../../model/infrastructures/app-event/app-event-repository";
import { AssetRepository } from "../../model/infrastructures/assets/asset-repository";
import { IAppEventRepositoryToken } from "../../model/domains/app-event/app-event-repository";
import { IAssetRepositoryToken } from "../../model/domains/assets/repository/asset-repository";
import { container } from "tsyringe";
import { AppEventService } from "../../model/applications/app-event/app-event-service";
import { AssetService } from "../../model/applications/assets/asset-service";
import { IAppEventConverterToken } from "../../model/domains/app-event/i-app-event-converter";
import { ShowContentEventConverter } from "../../model/domains/app-event/show-content/show-content-event-converter";
import { PlayAudioEventConverter } from "../../model/domains/app-event/play-audio/play-audio-event-converter";
import { SlideshowEventConverter } from "../../model/domains/app-event/slideshow/slideshow-event-converter";
import { TransitionPageEventConverter } from "../../model/domains/app-event/transition/transition-page-event-converter";
import {
  KeyboardShortcutRepository,
  IKeyboardShortcutRepositoryToken,
} from "../../model/domains/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcutService } from "../../model/applications/keyboard-shortcut/keyboard-shortcut-service";

export class Container {
  static Register() {
    container.register(IAssetRepositoryToken, { useClass: AssetRepository });
    container.register(IAppEventRepositoryToken, {
      useClass: AppEventRepository,
    });

    container.register(AssetService, { useClass: AssetService });
    container.register(AppEventService, {
      useClass: AppEventService,
    });
    container.register(IAppEventConverterToken, {
      useClass: ShowContentEventConverter,
    });
    container.register(IAppEventConverterToken, {
      useClass: PlayAudioEventConverter,
    });
    container.register(IAppEventConverterToken, {
      useClass: SlideshowEventConverter,
    });
    container.register(IAppEventConverterToken, {
      useClass: TransitionPageEventConverter,
    });
    // event factories removed; converters handle entity creation
    container.register(IKeyboardShortcutRepositoryToken, {
      useClass: KeyboardShortcutRepository,
    });
    container.register(KeyboardShortcutService, {
      useClass: KeyboardShortcutService,
    });
  }
}
