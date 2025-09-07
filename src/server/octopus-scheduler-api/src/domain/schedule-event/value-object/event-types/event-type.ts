import { IScheduleEvent } from "../../entity/schedule-event";

export interface IScheduleEventType {

    scheduleEventType: string;

    // 画面表示用
    displayName: string;
    displayDescription: string;

    createEvent(scheduleEventName: string): IScheduleEvent | null;
}