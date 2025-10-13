import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { ShowImageEventDto } from "../../../domain/schedule-event/entity/events/show-image-event";

@injectable()
export class ShowImageEventService implements GasService {
  public serviceName = "ShowImageEventService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getShowImageEvents: this.getShowImageEvents.bind(this),
      updateShowImageEvents: this.updateShowImageEvents.bind(this),
      deleteShowImageEvents: this.deleteShowImageEvents.bind(this),
      addShowImageEvents: this.addShowImageEvents.bind(this),
    };
  }

  getShowImageEvents(): ShowImageEventDto[] {
    const events = this.repository.getScheduleEvents();
    return events.filter(
      (e) => e.type === "ShowImageEvent"
    ) as ShowImageEventDto[];
  }

  updateShowImageEvents(args: ShowImageEventDto[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deleteShowImageEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addShowImageEvents(args: { events: ShowImageEventDto[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
