import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";
import { Schedule } from "../../../domains/schedule/entity/schedule";

export class GetScheduleUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(scheduleId: string): Promise<Schedule | null> {
    return await this.scheduleRepository.findById(scheduleId);
  }
}
