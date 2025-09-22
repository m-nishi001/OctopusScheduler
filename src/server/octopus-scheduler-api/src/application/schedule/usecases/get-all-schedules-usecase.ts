import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class GetAllSchedulesUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(): IScheduleEvent[] {
        try {
            return this.repository
                .findAll()
                .map(scheduleEvent => this.scheduleEventFactories.find(f => f.supports(scheduleEvent.scheduleEventType))?.create(scheduleEvent))
                .filter((event): event is IScheduleEvent => event !== null)
                .map(event => event.serialize());
        } catch (error) {
            Logger.log(`[GetAllSchedulesUseCase] error: ${error}`);
            return [];
        }
    }
}
