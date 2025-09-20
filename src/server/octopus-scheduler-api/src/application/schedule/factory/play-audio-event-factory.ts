import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { PlayAudioEventType } from "../../../domain/schedule-event/value-object/event-types/events/play-audio-event-type";
import { PlayAudioEvent } from "../../../domain/schedule-event/entity/events/play-audio-event";
import { IScheduleEventType } from "../../../domain/schedule-event/value-object/event-types/event-type";
import { injectable } from "tsyringe";

@injectable()
export class PlayAudioEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new PlayAudioEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.createByClient(obj);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayAudioEvent.from(obj);
    }
}
