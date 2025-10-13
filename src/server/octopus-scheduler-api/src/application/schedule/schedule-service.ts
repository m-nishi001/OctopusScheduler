import { injectable, inject } from "tsyringe";
import { GasService } from "../gas-service";
import { IScheduleEventRepository } from "../../domain/schedule-event/schedule-event-reposiotry";
import { ScheduleEvent } from "../../domain/schedule-event/schedule-event";

@injectable()
export class ScheduleService implements GasService {
  public serviceName = "ScheduleService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getScheduleEvents: this.getScheduleEvents.bind(this),
      updateScheduleEvents: this.updateScheduleEvents.bind(this),
      deleteScheduleEvents: this.deleteScheduleEvents.bind(this),
      addScheduleEvents: this.addScheduleEvents.bind(this),
    };
  }

  getScheduleEvents(): ScheduleEvent[] {
    return this.repository.getScheduleEvents();
  }

  updateScheduleEvents(args: ScheduleEvent[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deleteScheduleEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addScheduleEvents(args: { events: ScheduleEvent[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
