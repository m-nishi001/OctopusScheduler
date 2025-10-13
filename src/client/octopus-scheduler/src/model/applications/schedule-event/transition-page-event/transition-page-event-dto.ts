import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { ScheduleTimeSpan } from "../../../domains/schedule-event/vo/schedule-timespan";

export class TransitionPageEventDto implements IScheduleEventDto {
  public readonly id: string;
  public readonly type: string = "TransitionPageEvent";
  public readonly name: string;
  public readonly timeSpan: ScheduleTimeSpan;
  public readonly detail: TransitionPageDetail;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: TransitionPageDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.name = name;
    this.timeSpan = timeSpan;
    this.detail = detail;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
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