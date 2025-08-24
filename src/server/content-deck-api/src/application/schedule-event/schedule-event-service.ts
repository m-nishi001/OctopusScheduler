import { inject, injectable } from "tsyringe";
import { GasService } from "../gas-service";
import { ScheduleEvent } from "../../domain/scheduler/entity/schedule-event";
import { IScheduleEventRepository } from "../../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventName } from "../../domain/scheduler/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../domain/scheduler/value-object/schedule-timespan";
import { ScheduleEventId } from "../../domain/scheduler/value-object/schedule-event-id";

@injectable()
export class ScheduleEventService implements GasService {
    serviceName: string = "ScheduleEventService";
    functions: Record<string, (args: any) => any>;
    repository: IScheduleEventRepository;

    constructor(@inject("IScheduleEventRepository") repository: IScheduleEventRepository) {
        this.repository = repository;
        this.functions = {
            "addScheduleEvents": this.addScheduleEvents,
            "findAllScheduleEvents": this.findAllScheduleEvents,
            "deleteSchedduleEvent": this.deleteSchedduleEvent,
            "updateScheduleEvents": this.updateScheduleEvents
        };
    }

    private addScheduleEvents(args: {
        eventName: string,
        start: Date,
        end: Date
    }[]): { addedCount: number } {
        Logger.log(`[ScheduleEventService.addScheduleEvents] args: ${JSON.stringify(args)}`);

        if (args.length === 0) {
            Logger.log(`[ScheduleEventService.addScheduleEvents] args is empty.`);
            return { addedCount: 0 };
        }

        try {
            const events = args.map(arg => {
                const eventName = ScheduleEventName.create(arg.eventName);
                if (!eventName) throw new Error();

                const timespan = ScheduleTimeSpan.create(arg.start, arg.end);
                if (!timespan) throw new Error();

                return new ScheduleEvent(eventName, timespan);
            });
            const addedCount = this.repository.add(events);
            return { addedCount: addedCount };
        } catch (e: any) {
            Logger.log(`[ScheduleEventService.addScheduleEvents] adding schedule-event was faild. ${e}`);
            return { addedCount: 0 };
        }
    }

    private updateScheduleEvents(args: {
        eventId: string,
        eventName: string,
        start: Date,
        end: Date
    }[]): { updatedCount: number } {
        if (args.length === 0) {
            Logger.log(`[ScheduleEventService.updateScheduleEvents] args is empty.`);
            return { updatedCount: 0 };
        }

        try {
            const events = args.map(arg => {
                const eventId = ScheduleEventId.from(arg.eventId);
                if (!eventId) throw new Error();

                const eventName = ScheduleEventName.create(arg.eventName);
                if (!eventName) throw new Error();

                const timespan = ScheduleTimeSpan.create(arg.start, arg.end);
                if (!timespan) throw new Error();

                return new ScheduleEvent(eventName, timespan, eventId);
            });
            const updatedCount = this.repository.update(
                (entity: ScheduleEvent) => events.some(event => event.eventId.equals(entity.eventId)),
                (entity: ScheduleEvent) => {
                    const updateSource = events.find(event => event.eventId.equals(entity.eventId))!;
                    return Object.assign(entity, updateSource);
                }
            );
            return { updatedCount: updatedCount };
        } catch(e) {
            Logger.log(`[ScheduleEventService.updateScheduleEvents] updating schedule-event was faild. ${e}`);
            return { updatedCount: 0 };
        }
    }

    private findAllScheduleEvents(): {
        eventId: string,
        eventName: string,
        start: Date,
        end: Date
    }[] {
        return this.repository
            .findAll()
            .map(scheduleEvent => {
                const obj = {
                    eventId: scheduleEvent.eventId.id,
                    eventName: scheduleEvent.eventName.name,
                    start: scheduleEvent.timeSpan.start,
                    end: scheduleEvent.timeSpan.end
                };
                return obj;
            });
    }

    private deleteSchedduleEvent(args: { eventId: string }[]): { deletedCount: number } {
        if (args.length === 0) {
            Logger.log(`[ScheduleEventService.deleteSchedduleEvent] args is empty.`);
            return { deletedCount: 0 };
        }

        try {
            const eventIds = args.map(arg => ScheduleEventId.from(arg.eventId));
            if (eventIds.some(eventId => !eventId)) throw new Error();

            const deletedCount = this.repository.delete(
                (entity: ScheduleEvent) => eventIds.some(eventId => eventId!.equals(entity.eventId))
            );
            Logger.log(`[ScheduleEventService.delteScheduleEvent] commpleted deleting schedule events. deleted count is ${deletedCount}`);
            return { deletedCount: deletedCount };
        } catch(e) {
            Logger.log(`[ScheduleEventService.deleteSchedduleEvent] deleting schedule event was failed. ${e}`);
            return { deletedCount: 0 };
        }
    }
}