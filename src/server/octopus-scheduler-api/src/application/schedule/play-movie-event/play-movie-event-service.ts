import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { PlayMovieEventDto } from "../../../domain/schedule-event/entity/events/play-movie-event";

@injectable()
export class PlayMovieEventService implements GasService {
  public serviceName = "PlayMovieEventService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getPlayMovieEvents: this.getPlayMovieEvents.bind(this),
      updatePlayMovieEvents: this.updatePlayMovieEvents.bind(this),
      deletePlayMovieEvents: this.deletePlayMovieEvents.bind(this),
      addPlayMovieEvents: this.addPlayMovieEvents.bind(this),
    };
  }

  getPlayMovieEvents(): PlayMovieEventDto[] {
    const events = this.repository.getScheduleEvents();
    return events.filter(
      (e) => e.type === "PlayMovieEvent"
    ) as PlayMovieEventDto[];
  }

  updatePlayMovieEvents(args: PlayMovieEventDto[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deletePlayMovieEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addPlayMovieEvents(args: { events: PlayMovieEventDto[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
