import { ScheduleEventId } from "../value-object/schedule-event-id";
import { ScheduleEventName } from "../value-object/schedule-event-name";
import { ScheduleTimeSpan } from "../value-object/schedule-timespan";

export class ScheduleEvent {
    static Empty: ScheduleEvent = new ScheduleEvent(
        ScheduleEventName.Empty,
        ScheduleTimeSpan.Empty,
        ScheduleEventId.Empty);

    eventId: ScheduleEventId
    eventName: ScheduleEventName;
    timeSpan: ScheduleTimeSpan;

    constructor(
        eventName: ScheduleEventName,
        timeSpan: ScheduleTimeSpan,
        eventId: ScheduleEventId | null = null) {
        this.eventId = eventId ?? ScheduleEventId.new();
        this.eventName = eventName;
        this.timeSpan = timeSpan;
    }

    equals(another: ScheduleEvent): boolean {
        return this.eventId.equals(another.eventId)
            && this.eventName.equals(another.eventName)
            && this.timeSpan.equals(another.timeSpan);
    }
}