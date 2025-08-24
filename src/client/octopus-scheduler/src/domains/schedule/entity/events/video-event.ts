import type { TimeSpan } from "../../vo/timespan";
import type { VideoDetail } from "../../vo/event-details/video-detail";
import type { IEvent } from "../event";

export class VideoEvent implements IEvent {
    public readonly id: string;
    private _eventName: string = "VideoEvent";
    private _timeSpan: TimeSpan;
    private eventDetail: VideoDetail;

    constructor(
        id: string,
        timeSpan: TimeSpan,
        detail: VideoDetail,
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

    public getDetail(): VideoDetail {
        return this.eventDetail;
    }

    public clone(newId: string): IEvent {
        return new VideoEvent(newId, this._timeSpan, this.eventDetail);
    }

    public execute(): void {
        this.eventDetail.execute();
    }
}