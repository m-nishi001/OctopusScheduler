import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { TransitionPageEvent } from '../../../domains/schedule-event/entity/events/transition-page-event';
import type { IScheduleEventType } from '../../../domains/schedule-event/vo/event-types/event-type';

@injectable()
export class TransitionPageEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === "TransitionPageEvent";
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.create(obj.scheduleEventName);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.from(obj);
    }
}
