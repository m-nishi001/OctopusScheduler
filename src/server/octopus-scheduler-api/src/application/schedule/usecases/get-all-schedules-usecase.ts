import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";

export class GetAllSchedulesUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(): any[] {
        return this.repository
            .findAll()
            .map(scheduleEvent => ({
                id: scheduleEvent.eventId.id,
                eventName: scheduleEvent.eventName.name,
                start: scheduleEvent.timeSpan.start,
                end: scheduleEvent.timeSpan.end,
                eventDetailJson: scheduleEvent.eventDetailJson
            }));
    }
}
