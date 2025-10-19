import { eventBus } from "../../../../core/event-bus";
import type { IScheduleEvent } from "../schedule-event";

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

  constructor(
    arg:
      | (IScheduleEvent & Partial<PlayAudioEvent>)
      | {
          id: string;
          startTime: Date;
          endTime: Date;
          audioId: string;
          fadeOutDuration?: number;
          processedAt: Date | null;
          registeredAt: Date;
          updatedAt: Date;
        }
  ) {
    if ((arg as IScheduleEvent).type) {
      const ev = arg as IScheduleEvent & Partial<PlayAudioEvent>;
      this.id = ev.id;
      this.startTime = new Date((ev as any).startTime);
      this.endTime = new Date((ev as any).endTime);
      this.audioId = (ev as any).audioId;
      const fo = (ev as any).fadeOutDuration;
      this.fadeOutDuration = fo == null || fo === "" ? undefined : Number(fo);
      const p = (ev as any).processedAt;
      this.processedAt = p == null || p === "" ? null : new Date(p);
      this.registeredAt = new Date((ev as any).registeredAt);
      this.updatedAt = new Date((ev as any).updatedAt);
    } else {
      const params = arg as {
        id: string;
        startTime: Date;
        endTime: Date;
        audioId: string;
        fadeOutDuration?: number;
        processedAt: Date | null;
        registeredAt: Date;
        updatedAt: Date;
      };
      this.id = params.id;
      this.startTime = params.startTime;
      this.endTime = params.endTime;
      this.audioId = params.audioId;
      this.fadeOutDuration = params.fadeOutDuration;
      this.processedAt = params.processedAt;
      this.registeredAt = params.registeredAt;
      this.updatedAt = params.updatedAt;
    }
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
