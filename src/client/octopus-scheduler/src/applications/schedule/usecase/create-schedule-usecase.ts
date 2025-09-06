import { Schedule } from "../../../domains/schedule/entity/schedule";
import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";

export class CreateScheduleUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(): Promise<void> {
    const newSchedule = Schedule.createNew();
    await this.scheduleRepository.save(newSchedule);
  }
}
