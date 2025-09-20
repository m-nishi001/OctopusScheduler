import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class UpdateScheduleEventUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: IScheduleEvent): { updated: boolean } {

        if (args.scheduleEventId === "") {
            Logger.log(`[UpdateScheduleEventUseCase] failed: scheduleEventId is empty`);
            return { updated: false };
        }

        const count = this.repository.update(
            (entity: IScheduleEvent) => entity.scheduleEventId === args.scheduleEventId,
            () => {
                const factory = this.scheduleEventFactories.find(f => f.supports(args.scheduleEventType));

                if (!factory) {
                    Logger.log(`[UpdateScheduleEventUseCase] failed: no factory found for scheduleEventType ${args.scheduleEventType}`);
                    throw new Error("Failed to find factory");
                }

                const entity = factory.createFromClient(args);

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
