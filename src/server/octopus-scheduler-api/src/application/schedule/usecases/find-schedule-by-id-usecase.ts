import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";
import { ScheduleEventId } from "../../../domain/schedule/value-object/schedule-event-id";

export class FindScheduleByIdUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(id: string): any | null {
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
