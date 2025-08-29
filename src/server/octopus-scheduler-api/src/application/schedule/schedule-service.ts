import { inject, injectable } from "tsyringe";
import { IScheduleEventRepository } from "../../domain/scheduler/schedule-event-reposiotry";
import { GasService } from "../gas-service";
import { ScheduleEvent } from "../../domain/scheduler/entity/schedule-event";
import { ScheduleEventName } from "../../domain/scheduler/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../domain/scheduler/value-object/schedule-timespan";
import { ScheduleEventId } from "../../domain/scheduler/value-object/schedule-event-id";

@injectable()
export class ScheduleService implements GasService {
    serviceName: string = "ScheduleService";
    functions: Record<string, (args: any) => any>;
    repository: IScheduleEventRepository;

    constructor(@inject("IScheduleEventRepository") repository: IScheduleEventRepository) {
        this.repository = repository;
        this.functions = {
            "save": this.save.bind(this),
            "delete": this.delete.bind(this),
            "getScheduleMetadatas": this.getScheduleMetadatas.bind(this),
            "findById": this.findById.bind(this)
        };
    }

    // Save or update a schedule event
    private save(json: string): { saved: boolean } {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            // Assume obj has id, eventName, start, end
            let eventId = obj.id ? ScheduleEventId.from(obj.id) : undefined;
            const eventName = ScheduleEventName.create(obj.eventName);
            const timespan = ScheduleTimeSpan.create(obj.start, obj.end);
            if (!eventName || !timespan) throw new Error('Invalid eventName or timespan');
            const event = new ScheduleEvent(eventName, timespan, eventId);
            if (eventId) {
                // update
                this.repository.update(
                    (entity: ScheduleEvent) => entity.eventId.equals(eventId!),
                    () => event
                );
            } else {
                // add
                this.repository.add([event]);
            }
            return { saved: true };
        } catch (e) {
            Logger.log(`[ScheduleService.save] failed: ${e}`);
            return { saved: false };
        }
    }


    // Delete a schedule event by id
    private delete(id: string): { deletedCount: number } {
        try {
            const eventId = ScheduleEventId.from(id);
            if (!eventId) throw new Error('Invalid eventId');
            const deletedCount = this.repository.delete((entity: ScheduleEvent) => entity.eventId.equals(eventId));
            return { deletedCount };
        } catch (e) {
            Logger.log(`[ScheduleService.delete] failed: ${e}`);
            return { deletedCount: 0 };
        }
    }


    // Get all schedule metadatas
    private getScheduleMetadatas(): any[] {
        return this.repository.findAll().map(scheduleEvent => ({
            scheduleId: scheduleEvent.eventId.id,
            eventName: scheduleEvent.eventName.name,
            lastUpdatedAt: scheduleEvent.timeSpan.end // or another field if available
        }));
    }

    // Find a schedule event by id
    private findById(id: string): any {
        const eventId = ScheduleEventId.from(id);
        if (!eventId) return null;
        const event = this.repository.findAll().find(e => e.eventId.equals(eventId));
        if (!event) return null;
        return {
            id: event.eventId.id,
            eventName: event.eventName.name,
            start: event.timeSpan.start,
            end: event.timeSpan.end
        };
    }
}
