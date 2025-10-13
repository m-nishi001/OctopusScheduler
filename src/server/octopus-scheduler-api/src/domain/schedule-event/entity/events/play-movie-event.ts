import { ScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class PlayMovieEventDto extends ScheduleEvent {
  public readonly detail: PlayMovieEventDetail;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: PlayMovieEventDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    super(
      id,
      "PlayMovieEvent",
      name,
      timeSpan,
      detail,
      processedAt,
      registeredAt,
      updatedAt
    );
    this.detail = detail;
  }
}

export class PlayMovieEventDetail {
  readonly movieId: string;
  readonly fadeOutDuration?: number;

  constructor(movieId: string, fadeOutDuration?: number) {
    this.movieId = movieId;
    this.fadeOutDuration = fadeOutDuration;
  }
}
