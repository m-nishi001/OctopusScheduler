import { ScheduleEventRepository } from '../../model/infrastructures/schedule-event/schedule-event-repository';
import type { IAssetRepository } from '../../model/domains/assets/repository/asset-repository';
import type { IScheduleEventRepository } from '../../model/domains/schedule-event/repository/schedule-event-repository';
import { AssetRepository } from '../../model/infrastructures/assets/asset-repository';
import { container } from 'tsyringe';
import { PlayAudioEvent } from '../../model/domains/schedule-event/entity/events/play-audio-event';
import { PlayMovieEvent } from '../../model/domains/schedule-event/entity/events/play-movie-event';
import { ShowImageEvent } from '../../model/domains/schedule-event/entity/events/show-image-event';
import { TransitionPageEvent } from '../../model/domains/schedule-event/entity/events/transition-page-event';

export class Container {

  static Register() {
    container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepository });
    container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });

    container.register("IScheduleEvent", { useClass: PlayAudioEvent });
    container.register("IScheduleEvent", { useClass: PlayMovieEvent });
    container.register("IScheduleEvent", { useClass: ShowImageEvent });
    container.register("IScheduleEvent", { useClass: TransitionPageEvent });
  }

}