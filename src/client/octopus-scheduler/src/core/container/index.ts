import { ScheduleEventRepository } from '../../model/infrastructures/schedule-event/schedule-event-repository';
import type { IAssetRepository } from '../../model/domains/assets/repository/asset-repository';
import type { IScheduleEventRepository } from '../../model/domains/schedule-event/repository/schedule-event-repository';
import { AssetRepository } from '../../model/infrastructures/assets/asset-repository';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../model/applications/schedule-event/schedule-event-service';
import type { IScheduleEventService } from '../../model/applications/schedule-event/ischedule-event-service';
import { AssetService } from '../../model/applications/assets/asset-service';
import { PlayAudioEvent } from '../../model/domains/schedule-event/entity/events/play-audio-event';
import { PlayMovieEvent } from '../../model/domains/schedule-event/entity/events/play-movie-event';
import { ShowImageEvent } from '../../model/domains/schedule-event/entity/events/show-image-event';
import { TransitionPageEvent } from '../../model/domains/schedule-event/entity/events/transition-page-event';

export class Container {

  static Register() {
    container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepository });
    container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });

    container.register<IScheduleEventService>("IScheduleEventService", { useClass: ScheduleEventService });
    container.register("AssetService", { useClass: AssetService });

    container.register("IScheduleEvent", { useClass: PlayAudioEvent });
    container.register("IScheduleEvent", { useClass: PlayMovieEvent });
    container.register("IScheduleEvent", { useClass: ShowImageEvent });
    container.register("IScheduleEvent", { useClass: TransitionPageEvent });
  }

}