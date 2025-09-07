import type { IScheduleEventType } from "../vo/event-types/event-type";
import type { ScheduleTimeSpan } from "../vo/schedule-timespan";

export interface IScheduleEvent {
    readonly scheduleEventId: string;
    readonly scheduleEventType: IScheduleEventType
    readonly scheduleEventName: string;
    readonly scheduleTimeSpan: ScheduleTimeSpan;
    readonly scheduleEventDetail: any; // 独自のプロパティ
    readonly processedAt: Date | null;
    readonly registeredAt: Date;
    readonly updatedAt: Date;

    // シリアライズ用
    serialize(): IScheduleEvent;

    // 更新系
    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): IScheduleEvent;
    updateEventName(newEventName: string): IScheduleEvent;
    updateEventDetail(newDetail: any): IScheduleEvent;
    markAsProcessed(processedAt: Date): IScheduleEvent;

    // イベントの実行
    executeScheduleEvent(): void;
}