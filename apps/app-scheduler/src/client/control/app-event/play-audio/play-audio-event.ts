import { eventBus } from "@octopus/client-common/events/event-bus";
import type { AppEvent } from "../app-event";
import type { PlayAudioEventData } from "@model/app-event/play-audio/play-audio-event-data";
import type { PlayAudioEventDto } from "../dto/app-event-dto";
import {
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
} from "@octopus/client-common/date-utils/date-utils";

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

export class PlayAudioEvent implements AppEvent {
  public readonly id: string;
  public readonly type = "PlayAudioEvent" as const;
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

  // Reconstructs an executable instance from persisted storage data.
  static fromRawData(raw: PlayAudioEventData): PlayAudioEvent {
    const params = new PlayAudioEventParams({
      id: raw.id,
      startTime: toDateOrNow(raw.startTime),
      endTime: toDateOrNow(raw.endTime),
      audioId: raw.audioId,
      fadeOutDuration: raw.fadeOutDuration,
      processedAt: toDateOrNull(raw.processedAt),
      registeredAt: toDateOrNow(raw.registeredAt),
      updatedAt: toDateOrNow(raw.updatedAt),
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

  serializeAsObject(): Record<string, unknown> {
    return {
      audioId: this.audioId,
      fadeOutDuration: this.fadeOutDuration,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      registeredAt: toISOStringSafe(this.registeredAt, true),
      updatedAt: toISOStringSafe(this.updatedAt, true),
    };
  }

  // Builds a new, effectively-immediate event from a UI-provided DTO
  // (e.g. a keyboard shortcut action). startTime/endTime are not meaningful
  // here since these events are executed directly rather than scheduled.
  static fromData(dto: PlayAudioEventDto): PlayAudioEvent {
    const now = new Date();
    return PlayAudioEvent.fromParams({
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
