import { eventBus } from "../../../core/event-bus";
import type { IScheduleEvent } from "./schedule-event";

export class ShowContentEvent implements IScheduleEvent {
  public readonly id: string;
  public readonly type: string = "ShowContentEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly contentType: "image" | "movie" | "html";
  public readonly contentId?: string;
  public readonly htmlString?: string;
  public readonly fadeOutDuration?: number;
  public readonly displayMode?: "fade" | "scroll-up" | "scroll-down";
  public readonly effect?: "fade" | "scroll" | "static";
  public readonly duration?: number;
  public readonly fadeInTime?: number;
  public readonly fadeOutTime?: number;
  public readonly scrollDirection?: "up" | "down" | "left" | "right";
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(params: {
    id: string;
    startTime: Date;
    endTime: Date;
    contentType: "image" | "movie" | "html";
    contentId?: string;
    htmlString?: string;
    fadeOutDuration?: number;
    displayMode?: "fade" | "scroll-up" | "scroll-down";
    effect?: "fade" | "scroll" | "static";
    duration?: number;
    fadeInTime?: number;
    fadeOutTime?: number;
    scrollDirection?: "up" | "down" | "left" | "right";
    processedAt: Date | null;
    registeredAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.contentType = params.contentType;
    this.contentId = params.contentId;
    this.htmlString = params.htmlString;
    this.fadeOutDuration = params.fadeOutDuration;
    this.displayMode = params.displayMode;
    this.effect = params.effect;
    this.duration = params.duration;
    this.fadeInTime = params.fadeInTime;
    this.fadeOutTime = params.fadeOutTime;
    this.scrollDirection = params.scrollDirection;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("showContent", {
        contentType: this.contentType,
        contentId: this.contentId,
        htmlString: this.htmlString,
        displayMode: this.displayMode,
        effect: this.effect,
        duration: this.duration,
        fadeInTime: this.fadeInTime,
        fadeOutTime: this.fadeOutTime,
        scrollDirection: this.scrollDirection,
      });
    } else {
      eventBus.emit("hideContent", { contentType: this.contentType });
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.contentType,
      this.contentId ?? "",
      this.htmlString ?? "",
      this.fadeOutDuration?.toString() ?? "",
      this.displayMode ?? "",
      this.effect ?? "",
      this.duration?.toString() ?? "",
      this.fadeInTime?.toString() ?? "",
      this.fadeOutTime?.toString() ?? "",
      this.scrollDirection ?? "",
      this.processedAt ? this.processedAt.toISOString() : "",
      this.registeredAt.toISOString(),
      this.updatedAt.toISOString(),
    ];
  }
}
