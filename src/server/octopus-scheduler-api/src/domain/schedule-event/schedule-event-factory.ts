import { PlayAudioEvent } from "./entity/events/play-audio-event";
import { PlayMovieEvent } from "./entity/events/play-movie-event";
import { ShowImageEvent } from "./entity/events/show-image-event";
import { TransitionPageEvent } from "./entity/events/transition-page-event";
import { IScheduleEvent } from "./entity/schedule-event";
import { PlayAudioEventType } from "./value-object/event-types/events/play-audio-event-type";
import { PlayMovieEventType } from "./value-object/event-types/events/play-movie-event-type";
import { ShowImageEventType } from "./value-object/event-types/events/show-image-event-type";
import { TransitionPageEventType } from "./value-object/event-types/events/transition-page-event";

export class ScheduleEventFactory {
    
    // クライアント側からの新規作成時用
    static convertFromClientObject(clientObject: IScheduleEvent): IScheduleEvent | null {
        if (clientObject.scheduleEventType.scheduleEventType === new PlayAudioEventType().scheduleEventType) {
            return PlayAudioEvent.createByClient(clientObject);
        }

        if (clientObject.scheduleEventType.scheduleEventType === new PlayMovieEventType().scheduleEventType) {
            return PlayMovieEvent.createByClient(clientObject);
        }

        if (clientObject.scheduleEventType.scheduleEventType === new ShowImageEventType().scheduleEventType) {
            return ShowImageEvent.createByClient(clientObject);
        }

        if (clientObject.scheduleEventType.scheduleEventType === new TransitionPageEventType().scheduleEventType) {
            return TransitionPageEvent.createByClient(clientObject);
        }

        return null;
    }

    // リポジトリから取得したオブジェクトをエンティティに変換する用
    static convertToEntity(source: IScheduleEvent): IScheduleEvent | null {
        
        if (source.scheduleEventType.scheduleEventType === new PlayAudioEventType().scheduleEventType) {
            return PlayAudioEvent.from(source);
        }

        if (source.scheduleEventType.scheduleEventType === new PlayMovieEventType().scheduleEventType) {
            return PlayMovieEvent.from(source);
        }

        if (source.scheduleEventType.scheduleEventType === new ShowImageEventType().scheduleEventType) {
            return ShowImageEvent.from(source);
        }

        if (source.scheduleEventType.scheduleEventType === new TransitionPageEventType().scheduleEventType) {
            return TransitionPageEvent.from(source);
        }

        return null;
    }
}