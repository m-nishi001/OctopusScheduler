import type { IScheduleEvent } from "../../../entity/schedule-event";
import type { IScheduleEventType } from "../event-type";
import { ShowImageEvent } from "../../../entity/events/show-image-event";

export class ShowImageEventType implements IScheduleEventType {

    readonly scheduleEventType: string = "ShowImageEvent";

    readonly displayName: string = "画像表示イベント";
    readonly displayDescription: string = "指定した画像を表示します。";

    createScheduleEvent(eventName: string): IScheduleEvent | null {
        return ShowImageEvent.create(eventName);
    }
}