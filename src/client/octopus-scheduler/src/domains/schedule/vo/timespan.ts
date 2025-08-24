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
}