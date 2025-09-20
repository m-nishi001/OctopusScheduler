import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class MarkEventsProcessedUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: { scheduleEventIds: string[] } | undefined): { updated: number } {
        if (!args || !Array.isArray(args.scheduleEventIds)) return { updated: 0 };
        const now = new Date();
        const updated = this.repository.update(
            (entity: IScheduleEvent) => args.scheduleEventIds.includes(entity.scheduleEventId),
            (entity: IScheduleEvent) => {
                const factory = this.scheduleEventFactories.find(f => f.supports(entity.scheduleEventType));

                if (!factory) throw new Error("Failed to find factory");

                const scheduleEvent = factory.create(entity);

                if (!scheduleEvent) throw new Error("Failed to convert to entity");

                return scheduleEvent.markAsProcessed(now);
            }
        );
        return { updated: updated };
    }
}
