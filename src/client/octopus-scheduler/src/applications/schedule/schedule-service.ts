import { Schedule } from "../../domains/schedule/entity/schedule";
import type { IEvent } from "../../domains/schedule/entity/event";
import type { IScheduleRepository } from "../../domains/schedule/repository/schedule-repository";
import { ScheduleRepository } from "../../infrastructures/schedule/schedule-repository";
import { CreateScheduleUseCase } from "./usecase/create-schedule-usecase";
import { AddEventUseCase } from "./usecase/add-event-usecase";
import { RemoveEventUseCase } from "./usecase/remove-event-usecase";
import { GetScheduleUseCase } from "./usecase/get-schedule-usecase";
import { ListSchedulesUseCase } from "./usecase/list-schedules-usecase";
import { DeleteScheduleUseCase } from "./usecase/delete-schedule-usecase";

export class ScheduleService {
        private readonly createUc: CreateScheduleUseCase;
        private readonly addEventUc: AddEventUseCase;
        private readonly removeEventUc: RemoveEventUseCase;
        private readonly getUc: GetScheduleUseCase;
        private readonly listUc: ListSchedulesUseCase;
        private readonly deleteUc: DeleteScheduleUseCase;

    constructor(scheduleRepository?: IScheduleRepository) {
        const repo = scheduleRepository ?? new ScheduleRepository();
        this.createUc = new CreateScheduleUseCase(repo);
        this.addEventUc = new AddEventUseCase(repo);
        this.removeEventUc = new RemoveEventUseCase(repo);
        this.getUc = new GetScheduleUseCase(repo);
        this.listUc = new ListSchedulesUseCase(repo);
        this.deleteUc = new DeleteScheduleUseCase(repo);
    }

    public async createNewSchedule(): Promise<void> {
            await this.createUc.execute();
    }

    public async addEventToSchedule(scheduleId: string, event: IEvent): Promise<void> {
            await this.addEventUc.execute(scheduleId, event);
    }

    public async removeEventFromSchedule(scheduleId: string, eventId: string): Promise<void> {
            await this.removeEventUc.execute(scheduleId, eventId);
    }

    public async getScheduleById(scheduleId: string): Promise<Schedule | null> {
            return await this.getUc.execute(scheduleId);
    }

    public async getAllSchedules(): Promise<Schedule[]> {
            return await this.listUc.execute();
    }

    public async deleteSchedule(scheduleId: string): Promise<void> {
            await this.deleteUc.execute(scheduleId);
    }
}