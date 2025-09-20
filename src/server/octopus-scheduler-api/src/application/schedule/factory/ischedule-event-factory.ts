import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";

export interface IScheduleEventFactory {
    supports(type: string): boolean;
    create(obj: IScheduleEvent): IScheduleEvent | null;
}
