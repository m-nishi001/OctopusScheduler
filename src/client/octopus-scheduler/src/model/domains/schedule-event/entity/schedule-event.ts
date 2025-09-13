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

    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): void;
    updateEventName(newEventName: string): void;
    updateEventDetail(newDetail: any): void;
    markAsProcessed(processedAt: Date): void;

    // イベントの実行
    executeScheduleEvent(): void;
}