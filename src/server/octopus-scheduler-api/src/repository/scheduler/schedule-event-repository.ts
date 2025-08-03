import { ScheduleEvent } from "../../domain/scheduler/entity/schedule-event";
import { IScheduleEventRepository } from "../../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventId } from "../../domain/scheduler/value-object/schedule-event-id";
import { inject, injectable } from "tsyringe";
import { ScheduleEventName } from "../../domain/scheduler/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../domain/scheduler/value-object/schedule-timespan";
import { IRepository } from "../repository";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
    private tableName: string;
    private externalRepository: IRepository;

    constructor(@inject("IRepository") externalRepository: IRepository) {
        this.tableName = "ScheduleEvent";
        this.externalRepository = externalRepository;
    }

    add(events: ScheduleEvent[]): number {
        const serialized = this.serialize(events);
        return this.externalRepository.insert(this.tableName, serialized);
    }

    find(predicate: (entity: ScheduleEvent) => boolean,): ScheduleEvent[] {
        const founds = this.externalRepository.select(
            this.tableName,
            (obj: any) => predicate(this.deserialize(obj))
        );
        return founds ? founds.map(this.deserialize) : [];
    }

    findAll(): ScheduleEvent[] {
        const founds = this.externalRepository.select(this.tableName, () => true);
        return founds ? founds.map(this.deserialize) : [];
    }

    update(
        predicate: (entity: ScheduleEvent) => boolean,
        executor: (entity: ScheduleEvent) => ScheduleEvent): number {
        return this.externalRepository.update(
            this.tableName,
            (obj: any) => predicate(this.deserialize(obj)),
            (obj: any) => this.serialize([executor(this.deserialize(obj))])[0]
        );
    }

    delete(predicate: (entity: ScheduleEvent) => boolean): number {
        return this.externalRepository.delete(
            this.tableName,
            (obj: any) => predicate(this.deserialize(obj))
        );
    }

    private serialize(scheduleEvents: ScheduleEvent[]): any[] {
        if (scheduleEvents.length === 0) return [];
        return scheduleEvents.map(scheduleEvent => {
            return {
                eventId: scheduleEvent.eventId.id,
                eventName: scheduleEvent.eventName.name,
                timeSpan: JSON.stringify(
                    {
                        start: Utilities.formatDate(new Date(scheduleEvent.timeSpan.start), "JST", "yyyy/MM/dd HH:mm:ss"),
                        end: Utilities.formatDate(new Date(scheduleEvent.timeSpan.end), "JST", "yyyy/MM/dd HH:mm:ss")
                    }
                )
            }
        });
    }

    private deserialize(obj: any): ScheduleEvent {
        Logger.log(`[ScheduleEventRepository.deserialize] obj: ${JSON.stringify(obj)}`);
        const timeSpan = JSON.parse(obj.timeSpan);
        return new ScheduleEvent(
            // デシリアライズなので各要素は原則シリアライズできるデータであるはず。よってnullにはならない。
            ScheduleEventName.create(obj.eventName)!,
            ScheduleTimeSpan.create(
                new Date(timeSpan.start),
                new Date(timeSpan.end)
            )!,
            ScheduleEventId.from(obj.eventId)!
        )
    }
}