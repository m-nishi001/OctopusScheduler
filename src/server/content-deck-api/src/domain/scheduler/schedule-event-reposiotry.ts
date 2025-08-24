import { ScheduleEvent } from "./entity/schedule-event";

export interface IScheduleEventRepository {
    add(events: ScheduleEvent[]): number;
    find(predicate: (entity: ScheduleEvent) => boolean,): ScheduleEvent[];
    findAll(): ScheduleEvent[];
    update(predicate: (entity: ScheduleEvent) => boolean, executor: (entity: ScheduleEvent) => ScheduleEvent): number;
    delete(predicate: (entity: ScheduleEvent) => boolean): number;
}