import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import type { IScheduleEventType } from '../../../domains/schedule-event/vo/event-types/event-type';

export interface IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean;
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null;
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null;
}
