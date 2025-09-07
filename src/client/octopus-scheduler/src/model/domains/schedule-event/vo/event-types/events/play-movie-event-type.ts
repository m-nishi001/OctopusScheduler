import type { IScheduleEvent } from "../../../entity/schedule-event";
import type { IScheduleEventType } from "../event-type";
import { PlayMovieEvent } from "../../../entity/events/play-movie-event";

export class PlayMovieEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "PlayMovieEvent";

    readonly displayName: string = "映像再生イベント";
    readonly displayDescription: string = "指定した映像を再生します。";

    createScheduleEvent(eventName: string): IScheduleEvent | null {
        return PlayMovieEvent.create(eventName);
    }
}