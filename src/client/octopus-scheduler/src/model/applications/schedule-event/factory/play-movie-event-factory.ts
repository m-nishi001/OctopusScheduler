import { injectable } from "tsyringe";
import type { IScheduleEventFactory } from "./ischedule-event-factory";
import type { IScheduleEvent } from '../../../domains/schedule-event/entity/schedule-event';
import { PlayMovieEventType } from '../../../domains/schedule-event/vo/event-types/events/play-movie-event-type';
import { PlayMovieEvent } from '../../../domains/schedule-event/entity/events/play-movie-event';
import type { IScheduleEventType } from '../../../domains/schedule-event/vo/event-types/event-type';

@injectable()
export class PlayMovieEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new PlayMovieEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.create(obj.scheduleEventName);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return PlayMovieEvent.from(obj);
    }
}
