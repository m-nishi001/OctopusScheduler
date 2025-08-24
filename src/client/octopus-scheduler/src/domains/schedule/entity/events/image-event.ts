import type { ImageDetail } from "../../vo/event-details/image-detail";
import type { TimeSpan } from "../../vo/timespan";
import type { IEvent } from "../event";

export class ImageEvent implements IEvent {
    public readonly id: string;
    private _eventName: string = "ImageEvent";
    private _timeSpan: TimeSpan;
    private eventDetail: ImageDetail;

    constructor(
        id: string,
        timeSpan: TimeSpan,
        detail: ImageDetail,
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

    public getDetail(): ImageDetail {
        return this.eventDetail;
    }

    public clone(newId: string): IEvent {
        return new ImageEvent(newId, this._timeSpan, this.eventDetail);
    }

    public execute(): void {
        this.eventDetail.execute();
    }
}