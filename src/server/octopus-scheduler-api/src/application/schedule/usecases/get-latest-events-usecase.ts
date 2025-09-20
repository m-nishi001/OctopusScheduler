import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class GetLatestEventsUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(
        targetTime?: string
    ): {
        startedEvents: (IScheduleEvent | null)[];
        endedEvents: (IScheduleEvent | null)[];
    } {
        const now = targetTime
            ? new Date(targetTime)
            : new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

        Logger.log(`[GetLatestEventsUseCase] targetTime: ${targetTime ? targetTime : 'not provided'}, now: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}`);

        const all = this.repository.find(e => !e.processedAt);
        const startedEvents = all.filter(e => e.scheduleTimeSpan.start <= now && now < e.scheduleTimeSpan.end);
        const endedEvents = all.filter(e => e.scheduleTimeSpan.end <= now);

        Logger.log(`[GetLatestEventsUseCase] returning startedEvents: ${JSON.stringify(startedEvents.map(e => e.scheduleEventId))}, endedEvents: ${JSON.stringify(endedEvents.map(e => e.scheduleEventId))}`);

        return {
            startedEvents: startedEvents.map(e => {
                const factory = this.scheduleEventFactories.find(f => f.supports(e.scheduleEventType));

                if (!factory) {
                    Logger.log(`[GetLatestEventsUseCase] failed: no factory found for scheduleEventType ${e.scheduleEventType}`);
                    return null;
                }

                return factory.create(e);
            }),

            endedEvents: endedEvents.map(e => {
                const factory = this.scheduleEventFactories.find(f => f.supports(e.scheduleEventType));

                if (!factory) {
                    Logger.log(`[GetLatestEventsUseCase] failed: no factory found for scheduleEventType ${e.scheduleEventType}`);
                    return null;
                }

                return factory.create(e);
            }),
        };
    }
}
