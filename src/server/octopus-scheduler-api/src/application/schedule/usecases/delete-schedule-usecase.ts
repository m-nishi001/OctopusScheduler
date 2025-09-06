import { IScheduleEventRepository } from "../../../domain/schedule/schedule-event-reposiotry";
import { ScheduleEventId } from "../../../domain/schedule/value-object/schedule-event-id";

export class DeleteScheduleUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(id: string): { deletedCount: number } {
        try {
            const eventId = ScheduleEventId.from(id);
            if (!eventId) throw new Error('Invalid eventId');
            const deletedCount = this.repository.delete((entity) => entity.eventId.equals(eventId));
            return { deletedCount };
        } catch (e) {
            Logger.log(`[DeleteScheduleUseCase] failed: ${e}`);
            return { deletedCount: 0 };
        }
    }
}
