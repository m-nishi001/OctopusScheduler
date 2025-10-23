import { ScheduleEventRepository } from "../../model/infrastructures/schedule-event/schedule-event-repository";
import { AssetRepository } from "../../model/infrastructures/assets/asset-repository";
import { IScheduleEventRepositoryToken } from "../../model/domains/schedule-event/schedule-event-repository";
import { IAssetRepositoryToken } from "../../model/domains/assets/repository/asset-repository";
import { container } from "tsyringe";
import { ScheduleEventService } from "../../model/applications/schedule-event/schedule-event-service";
import { AssetService } from "../../model/applications/assets/asset-service";
import { EventPollingService } from "../../model/applications/event-polling-service";
import { IScheduleEventConverterToken } from "../../model/domains/schedule-event/i-schedule-event-converter";
import { ShowContentEventConverter } from "../../model/domains/schedule-event/show-content/show-content-event-converter";
import { PlayAudioEventConverter } from "../../model/domains/schedule-event/play-audio/play-audio-event-converter";
import { SlideshowEventConverter } from "../../model/domains/schedule-event/slideshow/slideshow-event-converter";
import { TransitionPageEventConverter } from "../../model/domains/schedule-event/transition/transition-page-event-converter";

export class Container {
  static Register() {
    container.register(IAssetRepositoryToken, { useClass: AssetRepository });
    container.register(IScheduleEventRepositoryToken, {
      useClass: ScheduleEventRepository,
    });

    container.register(AssetService, { useClass: AssetService });
    container.register(ScheduleEventService, {
      useClass: ScheduleEventService,
    });
    container.registerSingleton(EventPollingService, EventPollingService);
    container.register(IScheduleEventConverterToken, {
      useClass: ShowContentEventConverter,
    });
    container.register(IScheduleEventConverterToken, {
      useClass: PlayAudioEventConverter,
    });
    container.register(IScheduleEventConverterToken, {
      useClass: SlideshowEventConverter,
    });
    container.register(IScheduleEventConverterToken, {
      useClass: TransitionPageEventConverter,
    });
  }
}
