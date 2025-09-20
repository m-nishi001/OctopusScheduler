import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { ShowImageEvent } from '../../../domains/schedule-event/entity/events/show-image-event';

@injectable()
export class ShowImageEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === ShowImageEvent.scheduleEventTypeName;
    }
    createFrom(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.from(obj);
    }
}
