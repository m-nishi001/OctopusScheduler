import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class FindScheduleByIdUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(scheduleId: string): IScheduleEvent | null {
        const event = this.repository.find((e) => e.scheduleEventId === scheduleId)[0];
        const factory = this.scheduleEventFactories.find(f => f.supports(event.scheduleEventType));

        if (!factory) {
            Logger.log(`[FindScheduleByIdUseCase] failed: no factory found for scheduleEventType ${event.scheduleEventType}`);
            return null;
        }

        return factory.create(event);
    }
}
