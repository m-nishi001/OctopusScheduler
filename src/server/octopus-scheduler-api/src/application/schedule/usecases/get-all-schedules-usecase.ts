import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class GetAllSchedulesUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(): IScheduleEvent[] {
        return this.repository
            .findAll()
            .map(scheduleEvent => {
                const factory = this.scheduleEventFactories.find(f => f.supports(scheduleEvent.scheduleEventType));

                if (!factory) {
                    Logger.log(`[GetAllSchedulesUseCase] failed: no factory found for scheduleEventType ${scheduleEvent.scheduleEventType}`);
                    return null;
                }

                return factory.create(scheduleEvent);
            })
            .filter((event): event is IScheduleEvent => event !== null)
            .map(event => event.serialize());
    }
}
