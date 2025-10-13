import { injectable } from "tsyringe";
import { ScheduleEventDto } from "../../../domains/schedule-event/entity/schedule-event";
import { PlayMovieEventDetail } from "../../../domains/schedule-event/entity/events/play-movie-event";

@injectable()
export class PlayMovieEventConverter {
  toDto(event: ScheduleEventDto): PlayMovieEventDetail {
    return event.detail as PlayMovieEventDetail;
  }

  toEntity(
    detail: PlayMovieEventDetail,
    baseEvent: Omit<ScheduleEventDto, "detail">
  ): ScheduleEventDto {
    return {
      ...baseEvent,
      detail,
    };
  }
}
