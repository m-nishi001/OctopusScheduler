export class ScheduleEventId {
    static Empty: ScheduleEventId = new ScheduleEventId("");

    id: string;
    private constructor(id: string) {
        this.id = id;
    }

    static new(): ScheduleEventId {
        return new ScheduleEventId(Utilities.getUuid());
    }

    static from(id: string): ScheduleEventId | null {
        if (id === "") {
            Logger.log(`[ScheduleEventId.from] id is empty.`);
            return null;
        }

        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(id)) {
            Logger.log(`[ScheduleEventId.from] id is invalid. id is ${id}`);
            return null;
        }

        return new ScheduleEventId(id);
    }

    equals(another: ScheduleEventId): boolean {
        return this.id === another.id;
    }
}