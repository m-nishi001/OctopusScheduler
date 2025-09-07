import { PlayMovieEvent } from "../../../entity/events/play-movie-event";
import { IScheduleEvent } from "../../../entity/schedule-event";
import { IScheduleEventType } from "../event-type";

export class PlayMovieEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "PlayMovieEvent";

    readonly displayName: string = "映像再生イベント";
    readonly displayDescription: string = "指定した映像を再生します。";

    createEvent(scheduleEventName: string): IScheduleEvent | null {
        return PlayMovieEvent.create(scheduleEventName);
    }
}