import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

export interface SlideshowEventParams {
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
}

export interface SlideshowEventRaw {
  id: string;
  type?: string;
  startTime: string | Date;
  endTime: string | Date;
  folderId: string;
  displayDuration?: string | number | null;
  transitionType: "fade" | "slide";
  slideDirection?: string | null;
  bgmIds?: string[] | string | null;
  processedAt?: string | null;
  registeredAt: string | Date;
  updatedAt: string | Date;
}

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

  static revive(raw: SlideshowEventRaw): SlideshowEvent {
    const startTime =
      raw.startTime instanceof Date ? raw.startTime : new Date(raw.startTime);
    const endTime =
      raw.endTime instanceof Date ? raw.endTime : new Date(raw.endTime);
    const registeredAt =
      raw.registeredAt instanceof Date
        ? raw.registeredAt
        : new Date(raw.registeredAt);
    const updatedAt =
      raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt);

    const dd = raw.displayDuration;
    const displayDuration = dd == null || dd === "" ? 0 : Number(dd);

    let bgmIds: string[];
    if (Array.isArray(raw.bgmIds)) bgmIds = raw.bgmIds;
    else if (typeof raw.bgmIds === "string")
      bgmIds =
        raw.bgmIds === "" ? [] : raw.bgmIds.split(",").map((s) => s.trim());
    else bgmIds = [];

    const processedAtRaw = raw.processedAt;
    const processedAt =
      processedAtRaw == null || processedAtRaw === ""
        ? null
        : new Date(processedAtRaw);

    const params: SlideshowEventParams = {
      id: raw.id,
      startTime,
      endTime,
      folderId: raw.folderId,
      displayDuration,
      transitionType: raw.transitionType,
      slideDirection: raw.slideDirection as any,
      bgmIds,
      processedAt,
      registeredAt,
      updatedAt,
    };

    return new SlideshowEvent(params);
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
