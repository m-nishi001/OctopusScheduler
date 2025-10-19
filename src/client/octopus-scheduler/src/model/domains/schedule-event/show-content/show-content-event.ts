import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

export interface ShowContentEventParams {
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
}

export interface ShowContentEventRaw {
  id: string;
  type?: string;
  startTime: string | Date;
  endTime: string | Date;
  contentType: "image" | "movie" | "html";
  contentId?: string;
  htmlString?: string;
  fadeOutDuration?: string | number | null;
  displayMode?: string | null;
  effect?: string | null;
  duration?: string | number | null;
  fadeInTime?: string | number | null;
  fadeOutTime?: string | number | null;
  scrollDirection?: string | null;
  processedAt?: string | null;
  registeredAt: string | Date;
  updatedAt: string | Date;
}

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

  static revive(raw: ShowContentEventRaw): ShowContentEvent {
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

    const fadeOutRaw = raw.fadeOutDuration;
    const fadeOutDuration =
      fadeOutRaw == null || fadeOutRaw === "" ? undefined : Number(fadeOutRaw);

    const durationRaw = raw.duration;
    const duration =
      durationRaw == null || durationRaw === ""
        ? undefined
        : Number(durationRaw);

    const fadeInRaw = raw.fadeInTime;
    const fadeInTime =
      fadeInRaw == null || fadeInRaw === "" ? undefined : Number(fadeInRaw);

    const fadeOutTimeRaw = raw.fadeOutTime;
    const fadeOutTime =
      fadeOutTimeRaw == null || fadeOutTimeRaw === ""
        ? undefined
        : Number(fadeOutTimeRaw);

    const processedAtRaw = raw.processedAt;
    const processedAt =
      processedAtRaw == null || processedAtRaw === ""
        ? null
        : new Date(processedAtRaw);

    const params: ShowContentEventParams = {
      id: raw.id,
      startTime,
      endTime,
      contentType: raw.contentType,
      contentId: raw.contentId,
      htmlString: raw.htmlString,
      fadeOutDuration,
      displayMode: raw.displayMode as any,
      effect: raw.effect as any,
      duration,
      fadeInTime,
      fadeOutTime,
      scrollDirection: raw.scrollDirection as any,
      processedAt,
      registeredAt,
      updatedAt,
    };

    return new ShowContentEvent(params);
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
