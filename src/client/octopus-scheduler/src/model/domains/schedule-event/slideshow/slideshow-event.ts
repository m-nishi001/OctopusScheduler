import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

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
    const r = raw as unknown as Record<string, unknown>;
    const startTime = new Date(r.startTime as string | Date);
    const endTime = new Date(r.endTime as string | Date);
    const registeredAt = new Date(r.registeredAt as string | Date);
    const updatedAt = new Date(r.updatedAt as string | Date);

    const displayDuration = Number(
      r.displayDuration as string | number | undefined
    );

    let bgmIds: string[];
    if (Array.isArray(r.bgmIds)) bgmIds = r.bgmIds as string[];
    else if (typeof r.bgmIds === "string")
      bgmIds =
        (r.bgmIds as string) === ""
          ? []
          : (r.bgmIds as string).split(",").map((s: string) => s.trim());
    else bgmIds = [];

    const processedAtRaw = r.processedAt as string | null | undefined;
    const processedAt =
      processedAtRaw == null || processedAtRaw === ""
        ? null
        : new Date(processedAtRaw);

    const params = new SlideshowEventParams({
      id: String(r.id),
      startTime,
      endTime,
      folderId: String(r.folderId),
      displayDuration,
      transitionType: r.transitionType as any,
      slideDirection: r.slideDirection as any,
      bgmIds,
      processedAt,
      registeredAt,
      updatedAt,
    });

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
