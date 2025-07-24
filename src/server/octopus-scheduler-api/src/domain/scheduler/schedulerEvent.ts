class SchedulerEvent {
    public eventId: string
    public eventName: string;

    constructor(eventName: string, eventId: string | null = null) {
        this.eventId = eventId ?? Utilities.getUuid();
        this.eventName = eventName;
    }
}