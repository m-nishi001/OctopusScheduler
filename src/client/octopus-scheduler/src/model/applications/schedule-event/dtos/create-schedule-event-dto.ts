export interface CreateScheduleEventDto {
    scheduleEventName: string;
    scheduleEventType: string;
    start: string;
    end: string;
    scheduleEventDetail?: any;
}