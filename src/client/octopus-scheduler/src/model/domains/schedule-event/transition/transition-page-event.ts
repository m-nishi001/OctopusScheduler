import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

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

  static revive(raw: IScheduleEvent): TransitionPageEvent {
    const r = raw as unknown as Record<string, unknown>;
    const startTime = new Date(r.startTime as string | Date);
    const endTime = new Date(r.endTime as string | Date);
    const registeredAt = new Date(r.registeredAt as string | Date);
    const updatedAt = new Date(r.updatedAt as string | Date);

    const fadeOutDuration = Number(
      r.fadeOutDuration as string | number | undefined
    );

    const processedAtRaw = r.processedAt as string | null | undefined;
    const processedAt =
      processedAtRaw == null || processedAtRaw === ""
        ? null
        : new Date(processedAtRaw);

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
      eventBus.emit("transitionPage", { transitionUrl: this.transitionUrl, manual: !!manual } as any);
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

  serializeAsObject(): Record<string, unknown> {
    return {
      transitionUrl: this.transitionUrl,
      fadeOutDuration: this.fadeOutDuration,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: this.registeredAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromData(data: Record<string, any>): TransitionPageEvent {
    const now = new Date();
    return TransitionPageEvent.fromParams({
      id: data.id,
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      transitionUrl: data.transitionUrl as string,
      fadeOutDuration: data.fadeOutDuration as number,
      processedAt: data.processedAt
        ? new Date(data.processedAt as string)
        : null,
      registeredAt: new Date(data.registeredAt as string),
      updatedAt: new Date(data.updatedAt as string),
    });
  }
}
