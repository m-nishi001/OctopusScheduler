import type { IScheduleEventEntity } from "../i-schedule-event-entity";

export class ShowContentEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "ShowContentEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly contentType: "image" | "movie" | "html";
  public readonly contentId?: string;
  public readonly htmlString?: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    startTime: Date,
    endTime: Date,
    contentType: "image" | "movie" | "html",
    contentId: string | undefined,
    htmlString: string | undefined,
    fadeOutDuration: number | undefined,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.contentType = contentType;
    this.contentId = contentId;
    this.htmlString = htmlString;
    this.fadeOutDuration = fadeOutDuration;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  toRecords(): Map<string, string> {
    return new Map([
      ["id", this.id],
      ["type", this.type],
      ["startTime", this.startTime.toISOString()],
      ["endTime", this.endTime.toISOString()],
      ["contentType", this.contentType],
      ["contentId", this.contentId ?? ""],
      ["htmlString", this.htmlString ?? ""],
      ["fadeOutDuration", this.fadeOutDuration?.toString() ?? ""],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
