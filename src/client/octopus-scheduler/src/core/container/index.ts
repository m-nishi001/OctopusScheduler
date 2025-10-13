import { ScheduleEventRepository } from "../../model/infrastructures/schedule-event/schedule-event-repository";
import type { IAssetRepository } from "../../model/domains/assets/repository/asset-repository";
import type { IScheduleEventRepository } from "../../model/domains/schedule-event/repository/schedule-event-repository";
import { AssetRepository } from "../../model/infrastructures/assets/asset-repository";
import { container } from "tsyringe";
import { ScheduleEventService } from "../../model/applications/schedule-event/schedule-event-service";
import { AssetService } from "../../model/applications/assets/asset-service";
import { PlayAudioEventConverter } from "../../model/applications/schedule-event/play-audio-event/play-audio-event-converter";
import { ShowContentEventConverter } from "../../model/applications/schedule-event/show-content-event/show-content-event-converter";
import { TransitionPageEventConverter } from "../../model/applications/schedule-event/transition-page-event/transition-page-event-converter";

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
    container.register("PlayAudioEventConverter", {
      useClass: PlayAudioEventConverter,
    });
    container.register("ShowContentEventConverter", {
      useClass: ShowContentEventConverter,
    });
    container.register("TransitionPageEventConverter", {
      useClass: TransitionPageEventConverter,
    });
  }
}
