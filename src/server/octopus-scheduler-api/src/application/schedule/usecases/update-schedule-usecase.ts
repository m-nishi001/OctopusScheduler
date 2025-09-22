import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { IScheduleEventFactory } from "../factory/ischedule-event-factory";

export class UpdateScheduleEventUseCase {
    constructor(
        private repository: IScheduleEventRepository,
        private scheduleEventFactories: IScheduleEventFactory[]
    ) { }

    execute(args: IScheduleEvent): { updated: boolean } {
        try {
            if (args.scheduleEventId === "") {
                Logger.log(`[UpdateScheduleEventUseCase] failed: scheduleEventId is empty`);
                return { updated: false };
            }

            const count = this.repository.update(
                (entity: IScheduleEvent) => entity.scheduleEventId === args.scheduleEventId,
                () => {
                    const factory = this.scheduleEventFactories.find(f => f.supports(args.scheduleEventType))!;
                    return factory.create(args)!;
                }
            );

            if (count === 0) {
                Logger.log(`[UpdateScheduleEventUseCase] failed: no entity updated for scheduleEventId ${args.scheduleEventId}`);
                return { updated: false };
            }

            return { updated: true };
        } catch (error) {
            Logger.log(`[UpdateScheduleEventUseCase] error: ${error}`);
            return { updated: false };
        }
    }
}
