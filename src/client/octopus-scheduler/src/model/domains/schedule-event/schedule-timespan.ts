export class ScheduleTimeSpan {
    static Empty: ScheduleTimeSpan = new ScheduleTimeSpan(new Date(1), new Date(1));

    start: Date;
    end: Date;
    private constructor(start: Date, end: Date) {
        this.start = start;
        this.end = end;
    }

    static create(start: Date, end: Date): ScheduleTimeSpan | null {
        if (end < start) {
            console.log(`[ScheduledTimespan.create] start or end time is invalid. can not be "end" after "start".`);
            return null;
        }
        return new ScheduleTimeSpan(start, end);
    }

    equals(another: ScheduleTimeSpan): boolean {
        return this.start.getTime() === another.start.getTime()
            && this.end.getTime() === another.end.getTime();
    }
}