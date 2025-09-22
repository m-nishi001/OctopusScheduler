import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class MarkEventsProcessedUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: { scheduleEventIds: string[] }): { updated: number } {
        try {
            if (!args || !Array.isArray(args.scheduleEventIds)) return { updated: 0 };

            const updated = this.repository.update(
                (entity: IScheduleEvent) => args.scheduleEventIds.includes(entity.scheduleEventId),
                (entity: IScheduleEvent) => {
                    const factory = this.scheduleEventFactories.find(f => f.supports(entity.scheduleEventType))!;
                    const scheduleEvent = factory.create(entity)!;
                    return scheduleEvent.markAsProcessed(new Date());
                }
            );
            return { updated: updated };
        } catch (error) {
            Logger.log(`[MarkEventsProcessedUseCase] error: ${error}`);
            return { updated: 0 };
        }
    }
}
