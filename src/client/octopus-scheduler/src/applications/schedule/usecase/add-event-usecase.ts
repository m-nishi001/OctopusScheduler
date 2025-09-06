import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";
import type { IEvent } from "../../../domains/schedule/entity/event";

export class AddEventUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(scheduleId: string, event: IEvent): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (!schedule) throw new Error("Schedule not found.");
    schedule.addEvent(event);
    await this.scheduleRepository.save(schedule);
  }
}
