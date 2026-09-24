import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEvent } from "../app-event";
import type { TransitionPageEventData } from "@model/app-event/transition/transition-page-event-data";
import type { TransitionPageEventDto } from "../dto/app-event-dto";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@octopus/client-common/date-utils/date-utils";

export class TransitionPageEventParams {
  id: string;
  startTime: Date;
  endTime: Date;
  transitionUrl: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    startTime: Date;
    endTime: Date;
    transitionUrl: string;
    fadeOutDuration?: number;
    processedAt: Date | null;
    registeredAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.transitionUrl = data.transitionUrl;
    this.fadeOutDuration = data.fadeOutDuration;
    this.processedAt = data.processedAt;
    this.registeredAt = data.registeredAt;
    this.updatedAt = data.updatedAt;
  }
}

export class TransitionPageEvent implements AppEvent {
  public readonly id: string;
  public readonly type = "TransitionPageEvent" as const;
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly transitionUrl: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  private constructor(params: TransitionPageEventParams) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.transitionUrl = params.transitionUrl;
    this.fadeOutDuration = params.fadeOutDuration;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
  }

  static fromParams(params: TransitionPageEventParams): TransitionPageEvent {
    return new TransitionPageEvent(params);
  }

  static createEmpty(): TransitionPageEvent {
    const now = new Date();
    const params = new TransitionPageEventParams({
      id: "",
      startTime: now,
      endTime: new Date(now.getTime() + 60000),
      transitionUrl: "",
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    return new TransitionPageEvent(params);
  }

  static fromRawData(raw: TransitionPageEventData): TransitionPageEvent {
    const params = new TransitionPageEventParams({
      id: raw.id,
      startTime: toDateOrNow(raw.startTime),
      endTime: toDateOrNow(raw.endTime),
      transitionUrl: raw.transitionUrl,
      fadeOutDuration: raw.fadeOutDuration,
      processedAt: toDateOrNull(raw.processedAt),
      registeredAt: toDateOrNow(raw.registeredAt),
      updatedAt: toDateOrNow(raw.updatedAt),
    });
    return new TransitionPageEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      try {
        eventBus.emit("transitionPage", {
          transitionUrl: this.transitionUrl,
          manual: !!manual,
        } as any);
      } catch (err) {
        console.error(
          `[TransitionPageEvent] failed to emit transitionPage id=${this.id} err=`,
          err
        );
      }
    }
  }

  serializeAsObject(): Record<string, unknown> {
    return {
      transitionUrl: this.transitionUrl,
      fadeOutDuration: this.fadeOutDuration,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  static fromData(dto: TransitionPageEventDto): TransitionPageEvent {
    const now = new Date();
    return TransitionPageEvent.fromParams({
      id: dto.id ?? "",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      transitionUrl: dto.transitionUrl,
      fadeOutDuration: dto.fadeOutDuration,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
  }
}
