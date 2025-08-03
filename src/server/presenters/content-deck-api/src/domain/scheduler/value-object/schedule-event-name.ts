export class ScheduleEventName {

    static Empty: ScheduleEventName = new ScheduleEventName("");

    name: string;
    private constructor(name: string) {
        this.name = name;
    }

    static create(name: string): ScheduleEventName | null {
        if (name === "") {
            Logger.log(`[ScheduleEventName.create] name is empty.`);
            return null;
        }
        return new ScheduleEventName(name);
    }

    equals(another: ScheduleEventName): boolean {
        return this.name === another.name;
    }
}