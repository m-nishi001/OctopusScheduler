import { eventBus } from "../../../../core/event-bus";
import type { IAppEvent } from "../app-event";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@common-lib/date-utils/date-utils";

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

export class ShowContentEvent implements IAppEvent {
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

  static revive(raw: IAppEvent): ShowContentEvent {
    const r = raw as unknown as Record<string, unknown>;
    const startTime = toDateOrNow(r.startTime);
    const endTime = toDateOrNow(r.endTime);
    const registeredAt = toDateOrNow(r.registeredAt);
    const updatedAt = toDateOrNow(r.updatedAt);

    const fadeOutDuration = Number(
      r.fadeOutDuration as string | number | undefined
    );
    const duration = Number(r.duration as string | number | undefined);
    const fadeInTime = Number(r.fadeInTime as string | number | undefined);
    const fadeOutTime = Number(r.fadeOutTime as string | number | undefined);

    const processedAt = toDateOrNull(r.processedAt);

    const params = new ShowContentEventParams({
      id: String(r.id),
      startTime,
      endTime,
      contentType: r.contentType as any,
      contentId: r.contentId as any,
      htmlString: r.htmlString as any,
      fadeOutDuration,
      displayMode: r.displayMode as any,
      effect: r.effect as any,
      duration,
      fadeInTime,
      fadeOutTime,
      scrollDirection: r.scrollDirection as any,
      processedAt,
      registeredAt,
      updatedAt,
    });

    return new ShowContentEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
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
        manual: !!manual,
      });
    } else {
      eventBus.emit("hideContent", { contentType: this.contentType });
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.contentId || "",
      this.processedAt ? this.processedAt.toISOString() : "",
      toISOStringSafe(this.registeredAt, true) ?? new Date().toISOString(),
      toISOStringSafe(this.updatedAt, true) ?? new Date().toISOString(),
    ];
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

  static fromData(data: Record<string, any>): ShowContentEvent {
    const now = new Date();
    const registeredAt = toDateOrNow(data.registeredAt);
    const updatedAt = toDateOrNow(data.updatedAt);

    return ShowContentEvent.fromParams({
      id: data.id,
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      contentType: data.contentType as "image" | "movie" | "html",
      contentId: data.contentId as string | undefined,
      htmlString: data.htmlString as string | undefined,
      fadeOutDuration: data.fadeOutDuration as number | undefined,
      displayMode: data.displayMode as
        | "fade"
        | "scroll-up"
        | "scroll-down"
        | undefined,
      effect: data.effect as "fade" | "scroll" | "static" | undefined,
      duration: data.duration as number | undefined,
      fadeInTime: data.fadeInTime as number | undefined,
      fadeOutTime: data.fadeOutTime as number | undefined,
      scrollDirection: data.scrollDirection as
        | "up"
        | "down"
        | "left"
        | "right"
        | undefined,
      processedAt: toDateOrNull(data.processedAt),
      registeredAt,
      updatedAt,
    });
  }
}
