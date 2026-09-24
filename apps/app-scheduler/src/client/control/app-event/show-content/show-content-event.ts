import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEvent } from "../app-event";
import type { ShowContentEventData } from "@model/app-event/show-content/show-content-event-data";
import type { ShowContentEventDto } from "../dto/app-event-dto";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@octopus/client-common/date-utils/date-utils";

export class ShowContentEventParams {
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

  constructor(data: {
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
    this.id = data.id;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.contentType = data.contentType;
    this.contentId = data.contentId;
    this.htmlString = data.htmlString;
    this.fadeOutDuration = data.fadeOutDuration;
    this.displayMode = data.displayMode;
    this.effect = data.effect;
    this.duration = data.duration;
    this.fadeInTime = data.fadeInTime;
    this.fadeOutTime = data.fadeOutTime;
    this.scrollDirection = data.scrollDirection;
    this.processedAt = data.processedAt;
    this.registeredAt = data.registeredAt;
    this.updatedAt = data.updatedAt;
  }
}

export class ShowContentEvent implements AppEvent {
  public readonly id: string;
  public readonly type = "ShowContentEvent" as const;
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

  private constructor(params: ShowContentEventParams) {
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

  static fromParams(params: ShowContentEventParams): ShowContentEvent {
    return new ShowContentEvent(params);
  }

  static createEmpty(): ShowContentEvent {
    const now = new Date();
    const params = new ShowContentEventParams({
      id: "",
      startTime: now,
      endTime: new Date(now.getTime() + 60000),
      contentType: "image",
      contentId: "",
      htmlString: "",
      fadeOutDuration: 0,
      displayMode: "fade",
      effect: "fade",
      duration: 3,
      fadeInTime: 1,
      fadeOutTime: 1,
      scrollDirection: "up",
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    return new ShowContentEvent(params);
  }

  static fromRawData(raw: ShowContentEventData): ShowContentEvent {
    const params = new ShowContentEventParams({
      id: raw.id,
      startTime: toDateOrNow(raw.startTime),
      endTime: toDateOrNow(raw.endTime),
      contentType: raw.contentType,
      contentId: raw.contentId,
      htmlString: raw.htmlString,
      fadeOutDuration: raw.fadeOutDuration,
      displayMode: raw.displayMode,
      effect: raw.effect,
      duration: raw.duration,
      fadeInTime: raw.fadeInTime,
      fadeOutTime: raw.fadeOutTime,
      scrollDirection: raw.scrollDirection,
      processedAt: toDateOrNull(raw.processedAt),
      registeredAt: toDateOrNow(raw.registeredAt),
      updatedAt: toDateOrNow(raw.updatedAt),
    });
    return new ShowContentEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("showContent", {
        eventId: this.id,
        contentType: this.contentType,
        contentId: this.contentId,
        htmlString: this.htmlString,
        displayMode: this.displayMode,
        effect: this.effect,
        duration: this.duration,
        fadeInTime: this.fadeInTime,
        fadeOutTime: this.fadeOutTime,
        scrollDirection: this.scrollDirection,
        manual: !!manual,
      });
    } else {
      eventBus.emit("hideContent", { contentType: this.contentType });
    }
  }

  serializeAsObject(): Record<string, unknown> {
    return {
      contentType: this.contentType,
      contentId: this.contentId,
      htmlString: this.htmlString,
      fadeOutDuration: this.fadeOutDuration,
      displayMode: this.displayMode,
      effect: this.effect,
      duration: this.duration,
      fadeInTime: this.fadeInTime,
      fadeOutTime: this.fadeOutTime,
      scrollDirection: this.scrollDirection,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  static fromData(dto: ShowContentEventDto): ShowContentEvent {
    const now = new Date();
    return ShowContentEvent.fromParams({
      id: dto.id ?? "",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      contentType: dto.contentType,
      contentId: dto.contentId,
      htmlString: dto.htmlString,
      fadeOutDuration: dto.fadeOutDuration,
      displayMode: dto.displayMode,
      effect: dto.effect,
      duration: dto.duration,
      fadeInTime: dto.fadeInTime,
      fadeOutTime: dto.fadeOutTime,
      scrollDirection: dto.scrollDirection,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
  }
}
