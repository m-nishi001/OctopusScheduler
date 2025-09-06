import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";

export class RemoveEventUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(scheduleId: string, eventId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(scheduleId);
    if (!schedule) throw new Error("Schedule not found.");
    schedule.removeEvent(eventId);
    await this.scheduleRepository.save(schedule);
  }
}
