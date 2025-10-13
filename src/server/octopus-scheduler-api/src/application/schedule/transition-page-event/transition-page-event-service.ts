import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { TransitionPageEventDto } from "../../../domain/schedule-event/entity/events/transition-page-event";

@injectable()
export class TransitionPageEventService implements GasService {
  public serviceName = "TransitionPageEventService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getTransitionPageEvents: this.getTransitionPageEvents.bind(this),
      updateTransitionPageEvents: this.updateTransitionPageEvents.bind(this),
      deleteTransitionPageEvents: this.deleteTransitionPageEvents.bind(this),
      addTransitionPageEvents: this.addTransitionPageEvents.bind(this),
    };
  }

  getTransitionPageEvents(): TransitionPageEventDto[] {
    const events = this.repository.getScheduleEvents();
    return events.filter(
      (e) => e.type === "TransitionPageEvent"
    ) as TransitionPageEventDto[];
  }

  updateTransitionPageEvents(args: TransitionPageEventDto[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deleteTransitionPageEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addTransitionPageEvents(args: { events: TransitionPageEventDto[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
