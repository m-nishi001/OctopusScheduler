import { IScheduleEvent } from "./entity/schedule-event";

export interface IScheduleEventRepository {
    add(events: IScheduleEvent[]): number;
    find(predicate: (entity: IScheduleEvent) => boolean): IScheduleEvent[];
    findAll(): IScheduleEvent[];
    update(predicate: (entity: IScheduleEvent) => boolean, executor: (entity: IScheduleEvent) => IScheduleEvent): number;
    delete(predicate: (entity: IScheduleEvent) => boolean): number;
}