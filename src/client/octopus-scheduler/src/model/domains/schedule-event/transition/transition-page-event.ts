import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

export interface TransitionPageEventParams {
  id: string;
  startTime: Date;
  endTime: Date;
  transitionUrl: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}

export interface TransitionPageEventRaw {
  id: string;
  type?: string;
  startTime: string | Date;
  endTime: string | Date;
  transitionUrl: string;
  fadeOutDuration?: string | number | null;
  processedAt?: string | null;
  registeredAt: string | Date;
  updatedAt: string | Date;
}

export class TransitionPageEvent implements IScheduleEvent {
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

  static revive(raw: TransitionPageEventRaw): TransitionPageEvent {
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

    const processedAtRaw = raw.processedAt;
    const processedAt =
      processedAtRaw == null || processedAtRaw === ""
        ? null
        : new Date(processedAtRaw);

    const params: TransitionPageEventParams = {
      id: raw.id,
      startTime,
      endTime,
      transitionUrl: raw.transitionUrl,
      fadeOutDuration,
      processedAt,
      registeredAt,
      updatedAt,
    };

    return new TransitionPageEvent(params);
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("transitionPage", { transitionUrl: this.transitionUrl });
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.transitionUrl,
      this.fadeOutDuration?.toString() ?? "",
      this.processedAt ? this.processedAt.toISOString() : "",
      this.registeredAt.toISOString(),
      this.updatedAt.toISOString(),
    ];
  }
}
