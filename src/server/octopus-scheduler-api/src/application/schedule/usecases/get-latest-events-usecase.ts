import { ScheduleEventFactory } from "../../../domain/schedule-event/schedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class GetLatestEventsUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(targetTime?: string) {
        const now = targetTime
            ? new Date(targetTime)
            : new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

        Logger.log(`[GetLatestEventsUseCase] targetTime: ${targetTime ? targetTime : 'not provided'}, now: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}`);

        const all = this.repository.find(e => !e.processedAt);
        const startEvents = all.filter(e => e.scheduleTimeSpan.start <= now && now < e.scheduleTimeSpan.end);
        const endEvents = all.filter(e => e.scheduleTimeSpan.end <= now);

        Logger.log(`[GetLatestEventsUseCase] returning startEvents: ${JSON.stringify(startEvents.map(e => e.scheduleEventId))}, endEvents: ${JSON.stringify(endEvents.map(e => e.scheduleEventId))}`);

        return {
            startEvents: startEvents.map(e => ScheduleEventFactory.convertToEntity(e)),
            endEvents: endEvents.map(e => ScheduleEventFactory.convertToEntity(e)),
        };
    }
}
