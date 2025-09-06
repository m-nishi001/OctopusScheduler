import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";
import { GetLatestEventsService } from "../../../domain/schedule/service/get-latest-events-service";

export class GetLatestEventsUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(targetTime?: string) {
        const now = targetTime
            ? new Date(targetTime)
            : new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));

        Logger.log(`[GetLatestEventsUseCase] targetTime: ${targetTime ? targetTime : 'not provided'}, now: ${Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')}`);

        const all = this.repository.findAll().filter(e => !e.processedAt);
        const { startEvents, endEvents } = GetLatestEventsService.execute(all, now);

        Logger.log(`[GetLatestEventsUseCase] returning startEvents: ${JSON.stringify(startEvents.map(e => e.eventId.id))}, endEvents: ${JSON.stringify(endEvents.map(e => e.eventId.id))}`);

        return {
            startEvents: startEvents.map(e => ({
                id: e.eventId.id,
                eventName: e.eventName.name,
                start: e.timeSpan.start,
                end: e.timeSpan.end,
                eventDetailJson: e.eventDetailJson
            })),
            endEvents: endEvents.map(e => ({
                id: e.eventId.id,
                eventName: e.eventName.name,
                start: e.timeSpan.start,
                end: e.timeSpan.end,
                eventDetailJson: e.eventDetailJson
            }))
        };
    }
}
