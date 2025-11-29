import { eventBus } from "../../../../core/event-bus";
import type { IAppEvent } from "../app-event";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@common-lib/date-utils/date-utils";

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

export class TransitionPageEvent implements IAppEvent {
  public readonly id: string;
  public readonly type: string = "TransitionPageEvent";
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

  static revive(raw: IAppEvent): TransitionPageEvent {
    const r = raw as unknown as Record<string, unknown>;
    const startTime = new Date(r.startTime as string | Date);
    const endTime = new Date(r.endTime as string | Date);
    const registeredAt = toDateOrNow(r.registeredAt);
    const updatedAt = toDateOrNow(r.updatedAt);

    const fadeOutDuration = Number(
      r.fadeOutDuration as string | number | undefined
    );

    const processedAt = toDateOrNull(r.processedAt);

    const params = new TransitionPageEventParams({
      id: String(r.id),
      startTime,
      endTime,
      transitionUrl: String(r.transitionUrl),
      fadeOutDuration,
      processedAt,
      registeredAt,
      updatedAt,
    });

    return new TransitionPageEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      console.debug(
        `[TransitionPageEvent] emit transitionPage id=${this.id} url=${this.transitionUrl} manual=${!!manual} ts=${Date.now()}`
      );
      try {
        eventBus.emit("transitionPage", {
          transitionUrl: this.transitionUrl,
          manual: !!manual,
        } as any);
        console.debug(
          `[TransitionPageEvent] emitted transitionPage id=${this.id} ts=${Date.now()}`
        );
      } catch (err) {
        console.error(
          `[TransitionPageEvent] failed to emit transitionPage id=${this.id} err=`,
          err
        );
      }
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.transitionUrl,
      this.fadeOutDuration?.toString() ?? "",
      this.processedAt ? this.processedAt.toISOString() : "",
      toISOStringSafe(this.registeredAt, true) ?? new Date().toISOString(),
      toISOStringSafe(this.updatedAt, true) ?? new Date().toISOString(),
    ];
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

  static fromData(data: Record<string, any>): TransitionPageEvent {
    const now = new Date();
    const registeredAt = toDateOrNow(data.registeredAt);
    const updatedAt = toDateOrNow(data.updatedAt);
    return TransitionPageEvent.fromParams({
      id: data.id,
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      transitionUrl: data.transitionUrl as string,
      fadeOutDuration: data.fadeOutDuration as number,
      processedAt: toDateOrNull(data.processedAt),
      registeredAt,
      updatedAt,
    });
  }
}
