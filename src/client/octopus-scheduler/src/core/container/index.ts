import { AppEventRepository } from "../../model/infrastructures/app-event/app-event-repository";
import { AssetRepository } from "../../model/infrastructures/assets/asset-repository";
import { IAppEventRepositoryToken } from "../../model/domains/app-event/app-event-repository";
import { IAssetRepositoryToken } from "../../model/domains/assets/repository/asset-repository";
import { container } from "tsyringe";
import { AppEventService } from "../../model/applications/app-event/app-event-service";
import { AssetService } from "../../model/applications/assets/asset-service";
import { IAppEventConverterToken } from "../../model/domains/app-event/i-app-event-converter";
import { IEventSerializerToken } from "../../model/domains/app-event/i-event-serializer";
import { ShowContentEventConverter } from "../../model/applications/app-event/event-converter/show-content-event-converter";
import { PlayAudioEventConverter } from "../../model/applications/app-event/event-converter/play-audio-event-converter";
import { StopAudioEventConverter } from "../../model/applications/app-event/event-converter/stop-audio-event-converter";
import { SlideshowEventConverter } from "../../model/applications/app-event/event-converter/slideshow-event-converter";
import { TransitionPageEventConverter } from "../../model/applications/app-event/event-converter/transition-page-event-converter";
import { ShowContentEventSerializer } from "../../model/infrastructures/app-event/serializers/show-content-event-serializer";
import { PlayAudioEventSerializer } from "../../model/infrastructures/app-event/serializers/play-audio-event-serializer";
import { StopAudioEventSerializer } from "../../model/infrastructures/app-event/serializers/stop-audio-event-serializer";
import { SlideshowEventSerializer } from "../../model/infrastructures/app-event/serializers/slideshow-event-serializer";
import { TransitionPageEventSerializer } from "../../model/infrastructures/app-event/serializers/transition-page-event-serializer";
import {
  KeyboardShortcutRepository,
  IKeyboardShortcutRepositoryToken,
} from "../../model/domains/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcutService } from "../../model/applications/keyboard-shortcut/keyboard-shortcut-service";
// Inline UIActionEntryToken so core doesn't need a separate token module
export const UIActionEntryToken = Symbol("UIActionEntry");
import { TransitionPageAction } from "../../ui/components/settings/app-events/events/transition-page/entry";
import { PlayAudioAction } from "../../ui/components/settings/app-events/events/play-audio/entry";
import { StopAudioAction } from "../../ui/components/settings/app-events/events/stop-audio/entry";
import { SlideshowAction } from "../../ui/components/settings/app-events/events/slideshow/entry";
import { ShowContentAction } from "../../ui/components/settings/app-events/events/show-content/entry";

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
      useClass: StopAudioEventConverter,
    });
    container.register(IAppEventConverterToken, {
      useClass: SlideshowEventConverter,
    });
    container.register(IAppEventConverterToken, {
      useClass: TransitionPageEventConverter,
    });
    // register dedicated serializers for persistence revive path
    container.register(IEventSerializerToken, {
      useClass: ShowContentEventSerializer,
    });
    container.register(IEventSerializerToken, {
      useClass: PlayAudioEventSerializer,
    });
    container.register(IEventSerializerToken, {
      useClass: StopAudioEventSerializer,
    });
    container.register(IEventSerializerToken, {
      useClass: SlideshowEventSerializer,
    });
    container.register(IEventSerializerToken, {
      useClass: TransitionPageEventSerializer,
    });
    // event factories removed; converters handle entity creation
    container.register(IKeyboardShortcutRepositoryToken, {
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
