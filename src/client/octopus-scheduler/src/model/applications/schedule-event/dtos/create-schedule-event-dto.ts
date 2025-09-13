export interface CreateScheduleEventDto {
    eventName: string;
    eventType: string;
    start: string; // ISO8601 or Date string
    end: string;   // ISO8601 or Date string
    detail?: any;  // event-specific detail, can be refined later
}