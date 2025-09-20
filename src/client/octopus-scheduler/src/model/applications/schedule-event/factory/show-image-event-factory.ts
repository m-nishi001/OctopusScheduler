import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { ShowImageEventType } from '../../../domains/schedule-event/vo/event-types/events/show-image-event-type';
import { ShowImageEvent } from '../../../domains/schedule-event/entity/events/show-image-event';
import type { IScheduleEventType } from '../../../domains/schedule-event/vo/event-types/event-type';

@injectable()
export class ShowImageEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new ShowImageEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.create(obj.scheduleEventName);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.from(obj);
    }
}
