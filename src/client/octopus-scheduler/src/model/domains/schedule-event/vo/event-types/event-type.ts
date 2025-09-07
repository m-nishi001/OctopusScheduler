import type { IScheduleEvent } from "../../entity/schedule-event";

export interface IScheduleEventType {

    scheduleEventType: string;

    // 画面表示用
    displayName: string;
    displayDescription: string;

    createScheduleEvent(scheduleEventName: string): IScheduleEvent | null;
}