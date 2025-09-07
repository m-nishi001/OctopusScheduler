import { IScheduleEvent } from "../../../entity/schedule-event";
import { TransitionPageEvent } from "../../../entity/events/transition-page-event";
import { IScheduleEventType } from "../event-type";

export class TransitionPageEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "TransitionPageEvent";

    readonly displayName: string = "ページ遷移イベント";
    readonly displayDescription: string = "指定したページに遷移します。";

    createEvent(eventName: string): IScheduleEvent | null {
        return TransitionPageEvent.create(eventName);
    }
}