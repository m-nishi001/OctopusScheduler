import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class AddScheduleEventUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: IScheduleEvent): { added: boolean } {
        try {
            const factory = this.scheduleEventFactories.find(f => f.supports(args.scheduleEventType))!;
            const entity = factory.create(args)!;
            const count = this.repository.add([entity]);
            if (count === 0) {
                Logger.log(`[AddScheduleEventUseCase] failed: no entity added for scheduleEventId ${args.scheduleEventId}`);
                return { added: false };
            }

            return { added: true };
        } catch (error) {
            Logger.log(`[AddScheduleEventUseCase] error: ${error}`);
            return { added: false };
        }
    }

}
