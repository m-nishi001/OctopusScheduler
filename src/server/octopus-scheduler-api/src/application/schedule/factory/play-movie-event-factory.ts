import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { PlayMovieEvent } from "../../../domain/schedule-event/entity/events/play-movie-event";
import { injectable } from "tsyringe";

@injectable()
export class PlayMovieEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === PlayMovieEvent.scheduleEventType;
    }
    create(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.from(obj);
    }
}
