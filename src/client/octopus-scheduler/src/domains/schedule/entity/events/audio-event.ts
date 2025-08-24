import type { AudioDetail } from "../../vo/event-details/audio-detail";
import type { TimeSpan } from "../../vo/timespan";
import type { IEvent } from "../event";

export class AudioEvent implements IEvent {
    public readonly id: string;
    private _eventName: string = "AudioEvent";
    private _timeSpan: TimeSpan;
    private eventDetail: AudioDetail;

    constructor(
        id: string,
        timeSpan: TimeSpan,
        detail: AudioDetail,
    ) {
        this.id = id;
        this._timeSpan = timeSpan;
        this.eventDetail = detail;
    }

    public getEventName(): string {
        return this._eventName;
    }

    public changeEventName(name: string): void {
        this._eventName = name;
    }

    public getTimeSpan(): TimeSpan {
        return this._timeSpan;
    }

    public updateTimeSpan(timeSpan: TimeSpan): void {
        this._timeSpan = timeSpan;
    }

    public getDetail(): AudioDetail {
        return this.eventDetail;
    }

    public clone(newId: string): IEvent {
        return new AudioEvent(newId, this._timeSpan, this.eventDetail);
    }

    public execute(): void {
        this.eventDetail.execute();
    }
}