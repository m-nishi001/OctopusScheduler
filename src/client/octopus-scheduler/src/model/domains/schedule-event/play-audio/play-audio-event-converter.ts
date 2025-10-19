import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "../i-schedule-event-converter";
import type { IScheduleEvent } from "../schedule-event";
import { PlayAudioEvent } from "./play-audio-event";

@injectable()
export class PlayAudioEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "PlayAudioEvent";
  }

  canRevive(raw: IScheduleEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return PlayAudioEvent.revive(raw);
  }
}
