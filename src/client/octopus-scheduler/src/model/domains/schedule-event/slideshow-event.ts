import { eventBus } from "../../../core/event-bus";
import type { IScheduleEvent } from "./schedule-event";

export class SlideshowEvent implements IScheduleEvent {
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

  constructor(params: {
    id: string;
    startTime: Date;
    endTime: Date;
    folderId: string;
    displayDuration: number;
    transitionType: "fade" | "slide";
    slideDirection?: "left" | "right" | "up" | "down";
    bgmIds: string[];
    processedAt: Date | null;
    registeredAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.folderId = params.folderId;
    this.displayDuration = params.displayDuration;
    this.transitionType = params.transitionType;
    this.slideDirection = params.slideDirection;
    this.bgmIds = params.bgmIds;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
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

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.folderId,
      this.displayDuration.toString(),
      this.transitionType,
      this.slideDirection ?? "",
      this.bgmIds.join(","),
      this.processedAt ? this.processedAt.toISOString() : "",
      this.registeredAt.toISOString(),
      this.updatedAt.toISOString(),
    ];
  }
}
