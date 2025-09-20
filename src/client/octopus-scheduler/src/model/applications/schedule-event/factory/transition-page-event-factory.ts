import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { TransitionPageEvent } from '../../../domains/schedule-event/entity/events/transition-page-event';

@injectable()
export class TransitionPageEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === TransitionPageEvent.scheduleEventTypeName;
    }
    createFrom(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.from(obj);
    }
}
