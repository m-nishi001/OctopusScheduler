import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";

export class DeleteScheduleUseCase {
    constructor(private repository: IScheduleEventRepository) { }

    execute(scheduleEventId: string): { deletedCount: number } {
        const deletedCount = this.repository.delete(entity => entity.scheduleEventId === scheduleEventId);
        return { deletedCount: deletedCount };
    }
}
