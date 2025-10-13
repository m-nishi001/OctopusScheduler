import { ScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class ShowImageEventDto extends ScheduleEvent {
  public readonly detail: ShowImageEventDetail;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: ShowImageEventDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    super(
      id,
      "ShowImageEvent",
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

export class ShowImageEventDetail {
  readonly imageId: string;
  readonly fadeOutDuration?: number;

  constructor(imageId: string, fadeOutDuration?: number) {
    this.imageId = imageId;
    this.fadeOutDuration = fadeOutDuration;
  }
}
