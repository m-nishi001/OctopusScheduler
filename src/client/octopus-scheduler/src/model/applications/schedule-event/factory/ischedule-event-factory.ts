import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';

export interface IScheduleEventFactory {
    supports(type: string): boolean;
    createFrom(obj: IScheduleEvent): IScheduleEvent | null;
}
