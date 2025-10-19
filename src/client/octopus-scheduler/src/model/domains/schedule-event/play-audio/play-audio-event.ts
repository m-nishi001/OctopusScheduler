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

  static revive(raw: IScheduleEvent): PlayAudioEvent {
    const r = raw as unknown as PlayAudioEventRaw;
    const startTime = new Date(r.startTime);
    const endTime = new Date(r.endTime);
    const registeredAt = new Date(r.registeredAt);
    const updatedAt = new Date(r.updatedAt);
    const fadeOutDuration = Number(r.fadeOutDuration);
    const processedAt =
      r.processedAt == null || r.processedAt === ""
        ? null
        : new Date(r.processedAt);

    const params: PlayAudioEventParams = {
      id: r.id,
      startTime,
      endTime,
      audioId: r.audioId,
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
