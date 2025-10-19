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

  constructor(
    arg:
      | (IScheduleEvent & Partial<SlideshowEvent>)
      | {
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
  ) {
    if ((arg as IScheduleEvent).type) {
      const ev = arg as IScheduleEvent & Partial<SlideshowEvent>;
      this.id = ev.id;
      this.startTime = new Date((ev as any).startTime);
      this.endTime = new Date((ev as any).endTime);
      this.folderId = (ev as any).folderId;
      const dd = (ev as any).displayDuration;
      this.displayDuration = dd == null || dd === "" ? 0 : Number(dd);
      this.transitionType = (ev as any).transitionType;
      this.slideDirection = (ev as any).slideDirection ?? undefined;
      const bgm = (ev as any).bgmIds;
      if (Array.isArray(bgm)) this.bgmIds = bgm;
      else if (typeof bgm === "string")
        this.bgmIds =
          bgm === "" ? [] : (bgm as string).split(",").map((s) => s.trim());
      else this.bgmIds = [];
      const p = (ev as any).processedAt;
      this.processedAt = p == null || p === "" ? null : new Date(p);
      this.registeredAt = new Date((ev as any).registeredAt);
      this.updatedAt = new Date((ev as any).updatedAt);
    } else {
      const params = arg as {
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
      };
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
