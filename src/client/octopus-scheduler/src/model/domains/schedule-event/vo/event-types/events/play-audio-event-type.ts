import type { IScheduleEvent } from "../../../entity/schedule-event";
import type { IScheduleEventType } from "../event-type";
import { PlayAudioEvent } from "../../../entity/events/play-audio-event";

export class PlayAudioEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "PlayAudioEvent";

    readonly displayName: string = "音声再生イベント";
    readonly displayDescription: string = "指定した音声を再生します。";

    createScheduleEvent(eventName: string): IScheduleEvent | null {
        return PlayAudioEvent.create(eventName);
    }
}