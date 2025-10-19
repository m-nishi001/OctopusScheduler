import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

export interface PlayAudioEventParams {
  id: string;
  startTime: Date;
  endTime: Date;
  audioId: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}

export interface PlayAudioEventRaw {
  id: string;
  type?: string;
  startTime: string | Date;
  endTime: string | Date;
  audioId: string;
  fadeOutDuration?: string | number | null;
  processedAt?: string | null;
  registeredAt: string | Date;
  updatedAt: string | Date;
}

export class PlayAudioEvent implements IScheduleEvent {
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

  static revive(raw: PlayAudioEventRaw): PlayAudioEvent {
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

    const params: PlayAudioEventParams = {
      id: raw.id,
      startTime,
      endTime,
      audioId: raw.audioId,
      fadeOutDuration,
      processedAt,
      registeredAt,
      updatedAt,
    };

    return new PlayAudioEvent(params);
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("playAudio", { audioId: this.audioId });
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
      this.registeredAt.toISOString(),
      this.updatedAt.toISOString(),
    ];
  }
}
