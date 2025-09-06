import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";

export class DeleteScheduleUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(scheduleId: string): Promise<void> {
    await this.scheduleRepository.delete(scheduleId);
  }
}
