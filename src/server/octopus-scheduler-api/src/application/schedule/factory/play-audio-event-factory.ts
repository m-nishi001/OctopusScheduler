import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { PlayAudioEvent } from "../../../domain/schedule-event/entity/events/play-audio-event";
import { injectable } from "tsyringe";

@injectable()
export class PlayAudioEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === PlayAudioEvent.scheduleEventType;
    }
    create(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.from(obj);
    }
}
