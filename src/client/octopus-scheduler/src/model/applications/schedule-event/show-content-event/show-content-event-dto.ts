import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { eventBus } from "../../../../core/event-bus";

export class ShowContentEventDto implements IScheduleEventDto {
  public readonly id: string;
  public readonly type: string = "ShowContentEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly contentType: "image" | "movie" | "html";
  public readonly contentId?: string;
  public readonly htmlString?: string;
  public readonly fadeOutDuration?: number;
  public readonly displayMode?: "fade" | "scroll-up" | "scroll-down";
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
    displayMode: "fade" | "scroll-up" | "scroll-down" | undefined,
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
    this.displayMode = displayMode;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("showContent", {
        contentType: this.contentType,
        contentId: this.contentId,
        htmlString: this.htmlString,
        displayMode: this.displayMode,
      });
    } else {
      eventBus.emit("hideContent", { contentType: this.contentType });
    }
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
      ["displayMode", this.displayMode ?? ""],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
