import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventType } from "../../../domain/schedule-event/value-object/event-types/event-type";

export interface IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean;
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null;
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null;
}
