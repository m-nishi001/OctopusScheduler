import { Schedule } from "../../../domains/schedule/entity/schedule";
import type { IScheduleRepository } from "../../../domains/schedule/repository/schedule-repository";

export class ListSchedulesUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(): Promise<Schedule[]> {
    return await this.scheduleRepository.findAll();
  }
}
