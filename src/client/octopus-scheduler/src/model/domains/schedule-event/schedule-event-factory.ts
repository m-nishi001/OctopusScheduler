import { PlayAudioEvent } from "./entity/events/play-audio-event";
import { PlayMovieEvent } from "./entity/events/play-movie-event";
import { ShowImageEvent } from "./entity/events/show-image-event";
import { TransitionPageEvent } from "./entity/events/transition-page-event";
import type { IScheduleEvent } from "./entity/schedule-event";
import { PlayAudioEventType } from "./vo/event-types/events/play-audio-event-type";
import { PlayMovieEventType } from "./vo/event-types/events/play-movie-event-type";
import { ShowImageEventType } from "./vo/event-types/events/show-image-event-type";
import { TransitionPageEventType } from "./vo/event-types/events/transition-page-event";

export class ScheduleEventFactory {

    static convertToEntity(event: IScheduleEvent): IScheduleEvent | null {
        if (event.scheduleEventType.scheduleEventType === new PlayAudioEventType().scheduleEventType) {
            return PlayAudioEvent.from(event);
        }

        if (event.scheduleEventType.scheduleEventType === new PlayMovieEventType().scheduleEventType) {
            return PlayMovieEvent.from(event);
        }

        if (event.scheduleEventType.scheduleEventType === new ShowImageEventType().scheduleEventType) {
            return ShowImageEvent.from(event);
        }

        if (event.scheduleEventType.scheduleEventType === new TransitionPageEventType().scheduleEventType) {
            return TransitionPageEvent.from(event);
        }

        return null;
    }

}