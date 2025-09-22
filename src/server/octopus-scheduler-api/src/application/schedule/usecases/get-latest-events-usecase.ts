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
        startedEvents: (IScheduleEvent)[];
        endedEvents: (IScheduleEvent)[];
    } {
        try {
            const now = targetTime
                ? new Date(targetTime)
                : new Date(Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss'));

            Logger.log(`[GetLatestEventsUseCase] targetTime: ${targetTime ? targetTime : 'not provided'}, now: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}`);

            const all = this.repository
                .find(e => e.startedAt === null || e.endedAt === null)
                .map(e => this.scheduleEventFactories.find(f => f.supports(e.scheduleEventType))?.create(e))
                .filter((e): e is IScheduleEvent => e !== null);

            Logger.log(`[GetLatestEventsUseCase] found events: ${JSON.stringify(all.map(e => e.serialize()))}`);

            const startedEvents = all
                .filter(e => e.startedAt === null)
                .filter(e => e.scheduleTimeSpan.start <= now && now < e.scheduleTimeSpan.end);

            const endedEvents = all
                .filter(e => e.endedAt === null)
                .filter(e => e.scheduleTimeSpan.end <= now);

            return {
                startedEvents: startedEvents.map(e => e.serialize()),
                endedEvents: endedEvents.map(e => e.serialize()),
            };
        } catch (error) {
            Logger.log(`[GetLatestEventsUseCase] error: ${error}`);
            return {
                startedEvents: [],
                endedEvents: [],
            };
        }
    }
}