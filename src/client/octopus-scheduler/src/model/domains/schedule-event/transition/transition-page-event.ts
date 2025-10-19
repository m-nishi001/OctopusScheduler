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

  static revive(raw: IScheduleEvent): TransitionPageEvent {
    const r = raw as unknown as TransitionPageEventRaw;
    const startTime = new Date(r.startTime);
    const endTime = new Date(r.endTime);
    const registeredAt = new Date(r.registeredAt);
    const updatedAt = new Date(r.updatedAt);

    const fadeOutDuration = Number(r.fadeOutDuration);

    const processedAt =
      r.processedAt == null || r.processedAt === ""
        ? null
        : new Date(r.processedAt);

    const params: TransitionPageEventParams = {
      id: r.id,
      startTime,
      endTime,
      transitionUrl: r.transitionUrl,
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
