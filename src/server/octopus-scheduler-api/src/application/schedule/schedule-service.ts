import { inject, injectable } from "tsyringe";
import { IScheduleEventRepository } from "../../domain/schedule/schedule-event-reposiotry";
import { GasService } from "../gas-service";
import { SaveScheduleUseCase } from "./usecases/save-schedule-usecase";
import { DeleteScheduleUseCase } from "./usecases/delete-schedule-usecase";
import { GetAllSchedulesUseCase } from "./usecases/get-all-schedules-usecase";
import { FindScheduleByIdUseCase } from "./usecases/find-schedule-by-id-usecase";
import { GetLatestEventsUseCase } from "./usecases/get-latest-events-usecase";
import { MarkEventsProcessedUseCase } from "./usecases/mark-events-processed-usecase";

@injectable()
export class ScheduleService implements GasService {
    serviceName: string = "ScheduleService";
    functions: Record<string, (args: any) => any>;
    repository: IScheduleEventRepository;

    constructor(@inject("IScheduleEventRepository") repository: IScheduleEventRepository) {
        this.repository = repository;
        const saveUc = new SaveScheduleUseCase(this.repository);
        const deleteUc = new DeleteScheduleUseCase(this.repository);
        const getAllUc = new GetAllSchedulesUseCase(this.repository);
        const findByIdUc = new FindScheduleByIdUseCase(this.repository);
        const getLatestUc = new GetLatestEventsUseCase(this.repository);
        const markProcessedUc = new MarkEventsProcessedUseCase(this.repository);

        this.functions = {
            "save": (args: any) => saveUc.execute(args),
            "delete": (id: string) => deleteUc.execute(id),
            "getAllScheduleEvents": () => getAllUc.execute(),
            "findById": (id: string) => findByIdUc.execute(id),
            "getLatestEvent": (args?: { targetTime?: string }) => getLatestUc.execute(args && args.targetTime ? args.targetTime : undefined),
            "markEventsAsProcessed": (args: { eventIds: string[] }) => markProcessedUc.execute(args)
        };
    }
}
