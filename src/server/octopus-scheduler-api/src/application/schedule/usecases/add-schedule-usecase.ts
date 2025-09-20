import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class AddScheduleEventUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: IScheduleEvent): { added: boolean } {

        const factory = this.scheduleEventFactories.find(f => f.supports(args.scheduleEventType));
        if (!factory) {
            Logger.log(`[AddScheduleEventUseCase] failed: no factory found for scheduleEventType ${args.scheduleEventType}`);
            return { added: false };
        }
        
        const entity = factory.createFromClient(args);

        if (!entity) throw new Error("Failed to convert to entity");

        const count = this.repository.add([entity]);
        if (count === 0) {
            Logger.log(`[AddScheduleEventUseCase] failed: no entity added for scheduleEventId ${args.scheduleEventId}`);
            return { added: false };
        }

        return { added: true };
    }

}
