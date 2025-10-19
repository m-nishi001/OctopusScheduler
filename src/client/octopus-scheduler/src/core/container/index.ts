import { ScheduleEventRepository } from "../../model/infrastructures/schedule-event/schedule-event-repository";
import type { IAssetRepository } from "../../model/domains/assets/repository/asset-repository";
import type { IScheduleEventRepository } from "../../model/domains/schedule-event/schedule-event-repository";
import { AssetRepository } from "../../model/infrastructures/assets/asset-repository";
import { container } from "tsyringe";
import { ScheduleEventService } from "../../model/applications/schedule-event/schedule-event-service";
import { AssetService } from "../../model/applications/assets/asset-service";
// application-layer converters removed; domain entities are used directly
import { EventPollingService } from "../../model/applications/event-polling-service";
import { IScheduleEventConverterToken } from "../../model/infrastructures/schedule-event/i-schedule-event-converter";
import { ShowContentEventConverter } from "../../model/infrastructures/schedule-event/show-content-event-converter";
import { PlayAudioEventConverter } from "../../model/infrastructures/schedule-event/play-audio-event-converter";
import { SlideshowEventConverter } from "../../model/infrastructures/schedule-event/slideshow-event-converter";

export class Container {
  static Register() {
    container.register<IAssetRepository>("IAssetRepository", {
      useClass: AssetRepository,
    });
    container.register<IScheduleEventRepository>("IScheduleEventRepository", {
      useClass: ScheduleEventRepository,
    });

    container.register("AssetService", { useClass: AssetService });
    container.register("ScheduleEventService", {
      useClass: ScheduleEventService,
    });
    // no converters to register
    container.registerSingleton("EventPollingService", EventPollingService);
    // schedule event converters
    container.register(IScheduleEventConverterToken, {
      useClass: ShowContentEventConverter,
    });
    container.register(IScheduleEventConverterToken, {
      useClass: PlayAudioEventConverter,
    });
    container.register(IScheduleEventConverterToken, {
      useClass: SlideshowEventConverter,
    });
  }
}
