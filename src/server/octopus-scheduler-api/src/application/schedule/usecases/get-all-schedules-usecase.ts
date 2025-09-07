import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ScheduleEventFactory } from "../../../domain/schedule-event/schedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class GetAllSchedulesUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(): IScheduleEvent[] {
        return this.repository
            .findAll()
            .map(scheduleEvent => ScheduleEventFactory.convertToEntity(scheduleEvent))
            .filter((event): event is IScheduleEvent => event !== null)
            .map(event => event.serialize());
    }
}
