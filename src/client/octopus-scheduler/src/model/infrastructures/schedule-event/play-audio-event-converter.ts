import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "./i-schedule-event-converter";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { PlayAudioEvent } from "../../domains/schedule-event/play-audio-event";

@injectable()
export class PlayAudioEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "PlayAudioEvent";
  }

  canRevive(raw: any): boolean {
    return raw && raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return new PlayAudioEvent(raw);
  }
}
