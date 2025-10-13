import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { ShowContentEventDto } from "../../../domain/schedule-event/entity/events/show-content-event";

@injectable()
export class ShowContentEventService implements GasService {
  public serviceName = "ShowContentEventService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getShowContentEvents: this.getShowContentEvents.bind(this),
      updateShowContentEvents: this.updateShowContentEvents.bind(this),
      deleteShowContentEvents: this.deleteShowContentEvents.bind(this),
      addShowContentEvents: this.addShowContentEvents.bind(this),
    };
  }

  getShowContentEvents(): ShowContentEventDto[] {
    const events = this.repository.getScheduleEvents();
    return events.filter(
      (e) => e.type === "ShowContentEvent"
    ) as ShowContentEventDto[];
  }

  updateShowContentEvents(args: ShowContentEventDto[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deleteShowContentEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addShowContentEvents(args: { events: ShowContentEventDto[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
