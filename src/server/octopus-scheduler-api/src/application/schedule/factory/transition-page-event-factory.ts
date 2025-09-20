import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { TransitionPageEventType } from "../../../domain/schedule-event/value-object/event-types/events/transition-page-event";
import { TransitionPageEvent } from "../../../domain/schedule-event/entity/events/transition-page-event";
import { IScheduleEventType } from "../../../domain/schedule-event/value-object/event-types/event-type";
import { injectable } from "tsyringe";

@injectable()
export class TransitionPageEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new TransitionPageEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.createByClient(obj);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.from(obj);
    }
}
