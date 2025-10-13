import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IScheduleEventRepository } from "../../../domain/schedule-event/schedule-event-reposiotry";
import { ScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { PlayAudioEventDto } from "../../../domain/schedule-event/entity/events/play-audio-event";

@injectable()
export class PlayAudioEventService implements GasService {
  public serviceName = "PlayAudioEventService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IScheduleEventRepository")
    private readonly repository: IScheduleEventRepository
  ) {
    this.functions = {
      getPlayAudioEvents: this.getPlayAudioEvents.bind(this),
      updatePlayAudioEvents: this.updatePlayAudioEvents.bind(this),
      deletePlayAudioEvents: this.deletePlayAudioEvents.bind(this),
      addPlayAudioEvents: this.addPlayAudioEvents.bind(this),
    };
  }

  getPlayAudioEvents(): PlayAudioEventDto[] {
    const events = this.repository.getScheduleEvents();
    return events.filter(
      (e) => e.type === "PlayAudioEvent"
    ) as PlayAudioEventDto[];
  }

  updatePlayAudioEvents(args: PlayAudioEventDto[]): void {
    this.repository.updateScheduleEvents(args);
  }

  deletePlayAudioEvents(args: { ids: string[] }): void {
    this.repository.deleteScheduleEvents(args.ids);
  }

  addPlayAudioEvents(args: { events: PlayAudioEventDto[] }): void {
    this.repository.addScheduleEvents(args.events);
  }
}
