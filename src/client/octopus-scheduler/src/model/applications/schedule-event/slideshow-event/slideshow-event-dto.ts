import type { IScheduleEventDto } from "../i-schedule-event-dto";
import { eventBus } from "../../../../core/event-bus";

export class SlideshowEventDto implements IScheduleEventDto {
  public readonly id: string;
  public readonly type: string = "SlideshowEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly folderId: string;
  public readonly displayDuration: number;
  public readonly transitionType: "fade" | "slide";
  public readonly slideDirection?: "left" | "right" | "up" | "down";
  public readonly bgmIds: string[];
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    startTime: Date,
    endTime: Date,
    folderId: string,
    displayDuration: number,
    transitionType: "fade" | "slide",
    slideDirection: "left" | "right" | "up" | "down" | undefined,
    bgmIds: string[],
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.folderId = folderId;
    this.displayDuration = displayDuration;
    this.transitionType = transitionType;
    this.slideDirection = slideDirection;
    this.bgmIds = bgmIds;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("startSlideshow", {
        folderId: this.folderId,
        displayDuration: this.displayDuration,
        transitionType: this.transitionType,
        slideDirection: this.slideDirection,
        bgmIds: this.bgmIds,
      });
    } else {
      eventBus.emit("stopSlideshow");
    }
  }

  toRecords(): Map<string, string> {
    return new Map([
      ["startTime", this.startTime.toISOString()],
      ["endTime", this.endTime.toISOString()],
      ["folderId", this.folderId],
      ["displayDuration", this.displayDuration.toString()],
      ["transitionType", this.transitionType],
      ["slideDirection", this.slideDirection ?? ""],
      ["bgmIds", this.bgmIds.join(",")],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
