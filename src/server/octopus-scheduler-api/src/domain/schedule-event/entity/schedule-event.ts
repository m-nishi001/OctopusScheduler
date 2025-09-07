import { IScheduleEventType } from "../value-object/event-types/event-type";
import { ScheduleTimeSpan } from "../value-object/schedule-timespan";

export interface IScheduleEvent {
    readonly scheduleEventId: string;
    readonly scheduleEventType: IScheduleEventType
    readonly scheduleEventName: string;
    readonly scheduleTimeSpan: ScheduleTimeSpan;
    readonly scheduleEventDetail: any; // 独自のプロパティ
    readonly processedAt: Date | null;
    readonly registeredAt: Date;
    readonly updatedAt: Date;

    equals(another: IScheduleEvent): boolean;

    // シリアライズ系
    serialize(): IScheduleEvent
    
    // 更新系
    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): IScheduleEvent;
    updateEventName(newEventName: string): IScheduleEvent;
    updateEventDetail(newDetail: any): IScheduleEvent;
    markAsProcessed(processedAt: Date): IScheduleEvent;
}