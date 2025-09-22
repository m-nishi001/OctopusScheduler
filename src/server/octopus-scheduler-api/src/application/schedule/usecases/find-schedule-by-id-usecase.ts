import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class FindScheduleByIdUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(scheduleId: string): IScheduleEvent | null {
        try {
            const event = this.repository.find(e => e.scheduleEventId === scheduleId)[0];
            const factory = this.scheduleEventFactories.find(f => f.supports(event.scheduleEventType))!;
            return factory.create(event);
        } catch (error) {
            Logger.log(`[FindScheduleByIdUseCase] error: ${error}`);
            return null;
        }
    }
}
