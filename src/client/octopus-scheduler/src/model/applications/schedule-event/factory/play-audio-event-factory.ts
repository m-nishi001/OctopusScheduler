import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { PlayAudioEventType } from '../../../domains/schedule-event/vo/event-types/events/play-audio-event-type';
import { PlayAudioEvent } from '../../../domains/schedule-event/entity/events/play-audio-event';
import type { IScheduleEventType } from '../../../domains/schedule-event/vo/event-types/event-type';

@injectable()
export class PlayAudioEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new PlayAudioEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.create(obj.scheduleEventName);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.from(obj);
    }
}
