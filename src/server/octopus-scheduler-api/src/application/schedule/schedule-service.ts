import { inject, injectable, injectAll } from "tsyringe";
import { IScheduleEventRepository } from "../../domain/schedule-event/schedule-event-reposiotry";
import { IScheduleEventFactory } from "./factory/ischedule-event-factory";
import { GasService } from "../gas-service";
import { AddScheduleEventUseCase } from "./usecases/add-schedule-usecase";
import { DeleteScheduleUseCase } from "./usecases/delete-schedule-usecase";
import { GetAllSchedulesUseCase } from "./usecases/get-all-schedules-usecase";
import { FindScheduleByIdUseCase } from "./usecases/find-schedule-by-id-usecase";
import { GetLatestEventsUseCase } from "./usecases/get-latest-events-usecase";
import { MarkEventsProcessedUseCase } from "./usecases/mark-events-processed-usecase";
import { UpdateScheduleEventUseCase } from "./usecases/update-schedule-usecase";
import { IScheduleEvent } from "../../domain/schedule-event/entity/schedule-event";

@injectable()
export class ScheduleService implements GasService {
    serviceName: string = "ScheduleService";
    functions: Record<string, (args: any) => any>;
    repository: IScheduleEventRepository;

    constructor(
        @inject("IScheduleEventRepository") repository: IScheduleEventRepository,
        @injectAll("IScheduleEventFactory") factories: IScheduleEventFactory[]
    ) {
        this.repository = repository;

        const addUc = new AddScheduleEventUseCase(this.repository, factories);
        const getAllUc = new GetAllSchedulesUseCase(this.repository, factories);
        const findByIdUc = new FindScheduleByIdUseCase(this.repository, factories);
        const getLatestUc = new GetLatestEventsUseCase(this.repository, factories);
        const updateUc = new UpdateScheduleEventUseCase(this.repository, factories);
        const deleteUc = new DeleteScheduleUseCase(this.repository);
        const markProcessedUc = new MarkEventsProcessedUseCase(this.repository, factories);

        this.functions = {
            "add": (args: any) => addUc.execute(args),
            "findById": (id: string) => findByIdUc.execute(id),
            "findAll": () => getAllUc.execute(),
            "update": (args: any) => updateUc.execute(args),
            "delete": (id: string) => deleteUc.execute(id),
            "getLatestEvents": (args?: { targetTime?: string }): {
                startedEvents: (IScheduleEvent | null)[];
                endedEvents: (IScheduleEvent | null)[];
            } => getLatestUc.execute(args && args.targetTime ? args.targetTime : undefined),
            "markEventsAsProcessed": (args: { scheduleEventIds: string[] }) => markProcessedUc.execute(args)
        };
    }
}
