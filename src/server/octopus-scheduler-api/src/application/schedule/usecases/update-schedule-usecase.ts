import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ScheduleEventFactory } from "../../../domain/schedule-event/schedule-event-factory";

export class UpdateScheduleEventUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(args: IScheduleEvent): { updated: boolean } {

        if (args.scheduleEventId === "") {
            Logger.log(`[UpdateScheduleEventUseCase] failed: scheduleEventId is empty`);
            return { updated: false };
        }

        const count = this.repository.update(
            (entity: IScheduleEvent) => entity.scheduleEventId === args.scheduleEventId,
            () => {
                const entity = ScheduleEventFactory.convertFromClientObject(args);
                
                if (!entity) throw new Error("Failed to convert to entity");

                return entity;
            }
        );

        if (count === 0) {
            Logger.log(`[UpdateScheduleEventUseCase] failed: no entity updated for scheduleEventId ${args.scheduleEventId}`);
            return { updated: false };
        }

        return { updated: true };
    }
}
