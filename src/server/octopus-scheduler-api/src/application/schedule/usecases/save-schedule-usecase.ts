import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";
import { ScheduleEvent } from "../../../domain/schedule/entity/schedule-event";
import { ScheduleEventName } from "../../../domain/schedule/value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../../../domain/schedule/value-object/schedule-timespan";
import { ScheduleEventId } from "../../../domain/schedule/value-object/schedule-event-id";

export class SaveScheduleUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(json: any): { saved: boolean } {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            let eventId = obj.id ? ScheduleEventId.from(obj.id) : undefined;
            const eventName = ScheduleEventName.create(obj.eventName);
            const timespan = ScheduleTimeSpan.create(obj.start, obj.end);
            if (!eventName || !timespan) throw new Error('Invalid eventName or timespan');
            const eventDetailJson = obj.eventDetailJson ?? "{}";
            const event = new ScheduleEvent(eventName, timespan, eventId, eventDetailJson);
            if (eventId) {
                this.repository.update(
                    (entity: ScheduleEvent) => entity.eventId.equals(eventId!),
                    () => event
                );
            } else {
                this.repository.add([event]);
            }
            return { saved: true };
        } catch (e) {
            Logger.log(`[SaveScheduleUseCase] failed: ${e}`);
            return { saved: false };
        }
    }
}
