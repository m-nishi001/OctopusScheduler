import { eventBus } from "../../../../core/event-bus";
import type { IAppEvent } from "../app-event";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringOrEmpty,
  toISOStringSafe,
} from "@common-lib/date-utils/date-utils";

export class PlayAudioEventParams {
  id: string;
  startTime: Date;
  endTime: Date;
  audioId: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    startTime: Date;
    endTime: Date;
    audioId: string;
    fadeOutDuration?: number;
    processedAt: Date | null;
    registeredAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.audioId = data.audioId;
    this.fadeOutDuration = data.fadeOutDuration;
    this.processedAt = data.processedAt;
    this.registeredAt = data.registeredAt;
    this.updatedAt = data.updatedAt;
  }
}

export class PlayAudioEvent implements IAppEvent {
  public readonly id: string;
  public readonly type: string = "PlayAudioEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly audioId: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  private constructor(params: PlayAudioEventParams) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.audioId = params.audioId;
    this.fadeOutDuration = params.fadeOutDuration;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
  }

  static fromParams(params: PlayAudioEventParams): PlayAudioEvent {
    return new PlayAudioEvent(params);
  }

  static createEmpty(): PlayAudioEvent {
    const now = new Date();
    const params = new PlayAudioEventParams({
      id: "",
      startTime: now,
      endTime: new Date(now.getTime() + 60000),
      audioId: "",
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    return new PlayAudioEvent(params);
  }

  static revive(raw: IAppEvent): PlayAudioEvent {
    const r = raw as unknown as Record<string, unknown>;
    const startTime = new Date(r.startTime as string | Date);
    const endTime = new Date(r.endTime as string | Date);
    const registeredAt = toDateOrNow(r.registeredAt);
    const updatedAt = toDateOrNow(r.updatedAt);
    const fadeOutDuration = Number(
      r.fadeOutDuration as string | number | undefined
    );
    const processedAt = toDateOrNull(r.processedAt);

    const params = new PlayAudioEventParams({
      id: String(r.id),
      startTime,
      endTime,
      audioId: String(r.audioId),
      fadeOutDuration,
      processedAt,
      registeredAt,
      updatedAt,
    });

    return new PlayAudioEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("playAudio", {
        audioId: this.audioId,
        manual: !!manual,
      } as any);
    } else {
      eventBus.emit("stopAudio");
    }
  }

  serialize(): string[] {
    return [
      this.startTime.toISOString(),
      this.endTime.toISOString(),
      this.audioId,
      this.fadeOutDuration?.toString() ?? "",
      this.processedAt ? this.processedAt.toISOString() : "",
      toISOStringSafe(this.registeredAt, true) ?? new Date().toISOString(),
      toISOStringSafe(this.updatedAt, true) ?? new Date().toISOString(),
    ];
  }

  serializeAsObject(): Record<string, unknown> {
    return {
      audioId: this.audioId,
      fadeOutDuration: this.fadeOutDuration,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  static fromData(data: Record<string, any>): PlayAudioEvent {
    const now = new Date();
    const registeredAt = toDateOrNow(data.registeredAt);
    const updatedAt = toDateOrNow(data.updatedAt);
    return PlayAudioEvent.fromParams({
      id: data.id,
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      audioId: data.audioId as string,
      fadeOutDuration: data.fadeOutDuration as number,
      processedAt: toDateOrNull(data.processedAt),
      registeredAt,
      updatedAt,
    });
  }
}
