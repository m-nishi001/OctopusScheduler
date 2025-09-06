export class TimeSpan {
    public readonly startTime: Date;
    public readonly endTime: Date;

    constructor(startTime: Date, endTime: Date) {
        if (endTime < startTime) {
            throw new Error('終了時間は開始時間より後である必要があります。');
        }
        this.startTime = startTime;
        this.endTime = endTime;
    }
    public static from(obj: unknown): TimeSpan {
        if (obj instanceof TimeSpan) return obj;
        const plain = obj as Record<string, unknown> | undefined;
        if (!plain) throw new Error('Invalid TimeSpan object');
        const startVal = plain.startTime ?? plain.start;
        const endVal = plain.endTime ?? plain.end;
        const start = startVal ? new Date(String(startVal)) : null;
        const end = endVal ? new Date(String(endVal)) : null;
        if (!start || !end) throw new Error('Invalid TimeSpan data');
        return new TimeSpan(start, end);
    }
}