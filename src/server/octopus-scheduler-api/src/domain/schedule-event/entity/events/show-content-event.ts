import { ScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class ShowContentEventDto extends ScheduleEvent {
  public readonly detail: ShowContentEventDetail;

  constructor(
    id: string,
    name: string,
    timeSpan: ScheduleTimeSpan,
    detail: ShowContentEventDetail,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    super(
      id,
      "ShowContentEvent",
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
