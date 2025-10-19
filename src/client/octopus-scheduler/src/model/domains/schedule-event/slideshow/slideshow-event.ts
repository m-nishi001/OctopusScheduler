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

  static revive(raw: IScheduleEvent): SlideshowEvent {
    const r = raw as unknown as SlideshowEventRaw;
    const startTime = new Date(r.startTime);
    const endTime = new Date(r.endTime);
    const registeredAt = new Date(r.registeredAt);
    const updatedAt = new Date(r.updatedAt);

    const displayDuration = Number(r.displayDuration);

    let bgmIds: string[];
    if (Array.isArray(r.bgmIds)) bgmIds = r.bgmIds;
    else if (typeof r.bgmIds === "string")
      bgmIds = r.bgmIds === "" ? [] : r.bgmIds.split(",").map((s) => s.trim());
    else bgmIds = [];

    const processedAt =
      r.processedAt == null || r.processedAt === ""
        ? null
        : new Date(r.processedAt);

    const params: SlideshowEventParams = {
      id: r.id,
      startTime,
      endTime,
      folderId: r.folderId,
      displayDuration,
      transitionType: r.transitionType,
      slideDirection: r.slideDirection as any,
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
