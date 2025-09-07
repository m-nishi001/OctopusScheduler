import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ScheduleEventFactory } from "../../../domain/schedule-event/schedule-event-factory";

export class AddScheduleEventUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(args: IScheduleEvent): { added: boolean } {

        const entity = ScheduleEventFactory.convertFromClientObject(args)

        if (!entity) throw new Error("Failed to convert to entity");

        const count = this.repository.add([entity]);
        if (count === 0) {
            Logger.log(`[AddScheduleEventUseCase] failed: no entity added for scheduleEventId ${args.scheduleEventId}`);
            return { added: false };
        }

        return { added: true };
    }

}
