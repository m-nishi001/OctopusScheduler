import { ScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class TransitionPageEventDto extends ScheduleEvent {
  public readonly detail: TransitionPageDetail;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: TransitionPageDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    super(
      id,
      "TransitionPageEvent",
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

export class TransitionPageDetail {
  readonly transitionUrl: string;
  readonly fadeOutDuration?: number;

  constructor(transitionUrl: string, fadeOutDuration?: number) {
    this.transitionUrl = transitionUrl;
    this.fadeOutDuration = fadeOutDuration;
  }
}
