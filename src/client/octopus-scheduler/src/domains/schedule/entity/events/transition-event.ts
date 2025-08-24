import type { TimeSpan } from "../../vo/timespan";
import type { TransitionDetail } from "../../vo/event-details/transition-detail";
import type { IEvent } from "../event";

export class TransitionEvent implements IEvent {
    public readonly id: string;
    private _eventName: string = "TransitionEvent";
    private _timeSpan: TimeSpan;
    private eventDetail: TransitionDetail;

    constructor(
        id: string,
        timeSpan: TimeSpan,
        detail: TransitionDetail,
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

    public getDetail(): TransitionDetail {
        return this.eventDetail;
    }

    public clone(newId: string): IEvent {
        return new TransitionEvent(newId, this._timeSpan, this.eventDetail);
    }

    public execute(): void {
        this.eventDetail.execute();
    }
}