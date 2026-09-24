import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEvent } from "../app-event";
import type { StopAudioEventData } from "@model/app-event/stop-audio/stop-audio-event-data";
import type { StopAudioEventDto } from "../dto/app-event-dto";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@octopus/client-common/date-utils/date-utils";

export class StopAudioEventParams {
  id: string;
  startTime: Date;
  endTime: Date;
  audioId?: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;

  constructor(data: {
    id: string;
    startTime: Date;
    endTime: Date;
    audioId?: string;
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

export class StopAudioEvent implements AppEvent {
  public readonly id: string;
  public readonly type = "StopAudioEvent" as const;
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly audioId?: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  private constructor(params: StopAudioEventParams) {
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.audioId = params.audioId;
    this.fadeOutDuration = params.fadeOutDuration;
    this.processedAt = params.processedAt;
    this.registeredAt = params.registeredAt;
    this.updatedAt = params.updatedAt;
  }

  static fromParams(params: StopAudioEventParams): StopAudioEvent {
    return new StopAudioEvent(params);
  }

  static createEmpty(): StopAudioEvent {
    const now = new Date();
    const params = new StopAudioEventParams({
      id: "",
      startTime: now,
      endTime: new Date(now.getTime() + 60000),
      audioId: undefined,
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    return new StopAudioEvent(params);
  }

  static fromRawData(raw: StopAudioEventData): StopAudioEvent {
    const params = new StopAudioEventParams({
      id: raw.id,
      startTime: toDateOrNow(raw.startTime),
      endTime: toDateOrNow(raw.endTime),
      audioId: raw.audioId,
      fadeOutDuration: raw.fadeOutDuration,
      processedAt: toDateOrNull(raw.processedAt),
      registeredAt: toDateOrNow(raw.registeredAt),
      updatedAt: toDateOrNow(raw.updatedAt),
    });
    return new StopAudioEvent(params);
  }

  async execute(isStart: boolean, manual?: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("stopAudio", {
        audioId: this.audioId,
        fadeOutDuration: this.fadeOutDuration,
      } as any);
    }
  }

  serializeAsObject(): Record<string, unknown> {
    return {
      audioId: this.audioId ?? null,
      fadeOutDuration: this.fadeOutDuration,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  static fromData(dto: StopAudioEventDto): StopAudioEvent {
    const now = new Date();
    return StopAudioEvent.fromParams({
      id: dto.id ?? "",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      audioId: dto.audioId,
      fadeOutDuration: dto.fadeOutDuration,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
  }
}
