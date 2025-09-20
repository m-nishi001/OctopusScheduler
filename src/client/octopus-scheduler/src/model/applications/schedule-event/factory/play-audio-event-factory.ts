import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { PlayAudioEvent } from '../../../domains/schedule-event/entity/events/play-audio-event';

@injectable()
export class PlayAudioEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === PlayAudioEvent.scheduleEventTypeName;
    }
    createFrom(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.from(obj);
    }
}
