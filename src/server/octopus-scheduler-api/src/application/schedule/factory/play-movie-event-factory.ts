import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { PlayMovieEventType } from "../../../domain/schedule-event/value-object/event-types/events/play-movie-event-type";
import { PlayMovieEvent } from "../../../domain/schedule-event/entity/events/play-movie-event";
import { IScheduleEventType } from "../../../domain/schedule-event/value-object/event-types/event-type";
import { injectable } from "tsyringe";

@injectable()
export class PlayMovieEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new PlayMovieEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.createByClient(obj);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.from(obj);
    }
}
