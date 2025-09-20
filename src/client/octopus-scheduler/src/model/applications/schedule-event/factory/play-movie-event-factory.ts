import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { PlayMovieEvent } from '../../../domains/schedule-event/entity/events/play-movie-event';

@injectable()
export class PlayMovieEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === PlayMovieEvent.scheduleEventTypeName;
    }
    createFrom(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.from(obj);
    }
}
