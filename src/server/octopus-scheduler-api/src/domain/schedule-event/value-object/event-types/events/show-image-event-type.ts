import { IScheduleEvent } from "../../../entity/schedule-event";
import { ShowImageEvent } from "../../../entity/events/show-image-event";
import { IScheduleEventType } from "../event-type";

export class ShowImageEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "ShowImageEvent";

    readonly displayName: string = "画像表示イベント";
    readonly displayDescription: string = "指定した画像を表示します。";

    createEvent(eventName: string): IScheduleEvent | null {
        return ShowImageEvent.create(eventName);
    }
}