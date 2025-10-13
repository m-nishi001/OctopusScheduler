import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { ScheduleTimeSpan } from "../schedule-timespan";

export class ShowContentEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "ShowContentEvent";
  public readonly name: string;
  public readonly timeSpan: ScheduleTimeSpan;
  public readonly detail: ShowContentEventDetail;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: ShowContentEventDetail,
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

export class ShowContentEventDetail {
  readonly contentType: "image" | "movie" | "html";
  readonly contentId?: string;
  readonly htmlString?: string;
  readonly fadeOutDuration?: number;

  constructor(
    contentType: "image" | "movie" | "html",
    contentId?: string,
    htmlString?: string,
    fadeOutDuration?: number
  ) {
    this.contentType = contentType;
    this.contentId = contentId;
    this.htmlString = htmlString;
    this.fadeOutDuration = fadeOutDuration;
  }
}
