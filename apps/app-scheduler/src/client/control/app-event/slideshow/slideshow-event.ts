import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEvent } from "../app-event";
import type { SlideshowEventData } from "@model/app-event/slideshow/slideshow-event-data";
import type { SlideshowEventDto } from "../dto/app-event-dto";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@octopus/client-common/date-utils/date-utils";

export class SlideshowEventParams {
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

  constructor(data: {
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
    this.id = data.id;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.folderId = data.folderId;
    this.displayDuration = data.displayDuration;
    this.transitionType = data.transitionType;
    this.slideDirection = data.slideDirection;
    this.bgmIds = data.bgmIds;
    this.processedAt = data.processedAt;
    this.registeredAt = data.registeredAt;
    this.updatedAt = data.updatedAt;
  }
}

export class SlideshowEvent implements AppEvent {
  public readonly id: string;
  public readonly type = "SlideshowEvent" as const;
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

  private constructor(params: SlideshowEventParams) {
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

  static fromParams(params: SlideshowEventParams): SlideshowEvent {
    return new SlideshowEvent(params);
  }

  static createEmpty(): SlideshowEvent {
    const now = new Date();
    const params = new SlideshowEventParams({
      id: "",
      startTime: now,
      endTime: new Date(now.getTime() + 60000),
      folderId: "",
      displayDuration: 5,
      transitionType: "fade",
      slideDirection: "left",
      bgmIds: [],
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    return new SlideshowEvent(params);
  }

  static fromRawData(raw: SlideshowEventData): SlideshowEvent {
    const params = new SlideshowEventParams({
      id: raw.id,
      startTime: toDateOrNow(raw.startTime),
      endTime: toDateOrNow(raw.endTime),
      folderId: raw.folderId,
      displayDuration: raw.displayDuration,
      transitionType: raw.transitionType,
      slideDirection: raw.slideDirection,
      bgmIds: raw.bgmIds ?? [],
      processedAt: toDateOrNull(raw.processedAt),
      registeredAt: toDateOrNow(raw.registeredAt),
      updatedAt: toDateOrNow(raw.updatedAt),
    });
    return new SlideshowEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("startSlideshow", {
        folderId: this.folderId,
        displayDuration: this.displayDuration,
        transitionType: this.transitionType,
        slideDirection: this.slideDirection,
        bgmIds: this.bgmIds,
        manual: !!manual,
      } as any);
    } else {
      eventBus.emit("stopSlideshow");
    }
  }

  serializeAsObject(): Record<string, unknown> {
    return {
      folderId: this.folderId,
      displayDuration: this.displayDuration,
      transitionType: this.transitionType,
      slideDirection: this.slideDirection,
      bgmIds: this.bgmIds,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  static fromData(dto: SlideshowEventDto): SlideshowEvent {
    const now = new Date();
    return SlideshowEvent.fromParams({
      id: dto.id ?? "",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      folderId: dto.folderId,
      displayDuration: dto.displayDuration,
      transitionType: dto.transitionType ?? "fade",
      slideDirection: dto.slideDirection,
      bgmIds: dto.bgmIds ?? [],
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
  }
}
