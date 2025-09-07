import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ScheduleEventFactory } from "../../../domain/schedule-event/schedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class FindScheduleByIdUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(scheduleId: string): IScheduleEvent | null {
        const event = this.repository.find((e) => e.scheduleEventId === scheduleId)[0];
        return ScheduleEventFactory.convertToEntity(event);
    }
}
