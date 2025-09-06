import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";
import { ScheduleEvent } from "../../../domain/schedule/entity/schedule-event";

export class MarkEventsProcessedUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(args: { eventIds: string[] } | undefined): { updated: number } {
        if (!args || !Array.isArray(args.eventIds)) return { updated: 0 };
        const now = new Date();
        const updated = this.repository.update(
            (entity: ScheduleEvent) => args.eventIds.includes(entity.eventId.id),
            (entity: ScheduleEvent) => {
                return new ScheduleEvent(
                    entity.eventName,
                    entity.timeSpan,
                    entity.eventId,
                    entity.eventDetailJson,
                    now
                );
            }
        );
        return { updated };
    }
}
