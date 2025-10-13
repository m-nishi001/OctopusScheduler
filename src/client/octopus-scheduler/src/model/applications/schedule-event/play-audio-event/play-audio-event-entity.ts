import type { IScheduleEventEntity } from "../i-schedule-event-entity";
import { eventBus } from "../../../../core/event-bus";

export class PlayAudioEventEntity implements IScheduleEventEntity {
  public readonly id: string;
  public readonly type: string = "PlayAudioEvent";
  public readonly startTime: Date;
  public readonly endTime: Date;
  public readonly audioId: string;
  public readonly fadeOutDuration?: number;
  public readonly processedAt: Date | null;
  public readonly registeredAt: Date;
  public readonly updatedAt: Date;

  constructor(
    id: string,
    startTime: Date,
    endTime: Date,
    audioId: string,
    fadeOutDuration: number | undefined,
    processedAt: Date | null,
    registeredAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.audioId = audioId;
    this.fadeOutDuration = fadeOutDuration;
    this.processedAt = processedAt;
    this.registeredAt = registeredAt;
    this.updatedAt = updatedAt;
  }

  async execute(isStart: boolean): Promise<void> {
    if (isStart) {
      eventBus.emit("playAudio", { audioId: this.audioId });
    } else {
      eventBus.emit("stopAudio");
    }
  }

  toRecords(): Map<string, string> {
    return new Map([
      ["id", this.id],
      ["type", this.type],
      ["startTime", this.startTime.toISOString()],
      ["endTime", this.endTime.toISOString()],
      ["audioId", this.audioId],
      ["fadeOutDuration", this.fadeOutDuration?.toString() ?? ""],
      ["processedAt", this.processedAt ? this.processedAt.toISOString() : ""],
      ["registeredAt", this.registeredAt.toISOString()],
      ["updatedAt", this.updatedAt.toISOString()],
    ]);
  }
}
