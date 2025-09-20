import { IScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class TransitionPageEvent implements IScheduleEvent {

    static readonly scheduleEventType = "TransitionPageEvent";

    private _eventId: string;
    private _eventName: string;
    private _timeSpan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;

    // 独自のプロパティ
    private _eventDetail: TransitionPageDetail;

    private constructor(
        eventId: string,
        eventName: string,
        timeSpan: ScheduleTimeSpan,
        eventDetail: TransitionPageDetail,
        processedAt: Date | null,
        registeredAt: Date,
        updatedAt: Date
    ) {
        this._eventId = eventId;
        this._eventName = eventName;
        this._timeSpan = timeSpan;
        this._eventDetail = eventDetail;
        this._processedAt = processedAt;
        this._registeredAt = registeredAt;
        this._updatedAt = updatedAt;
    }

    static from(event: IScheduleEvent): TransitionPageEvent | null {
        if (!event || !event.scheduleEventName) {
            console.log(`[TransitionPageEvent.create] event or eventName is invalid.`);
            return null;
        }
        return new TransitionPageEvent(
            event.scheduleEventId === "" ? Utilities.getUuid() : event.scheduleEventId,
            event.scheduleEventName,
            event.scheduleTimeSpan,
            event.scheduleEventDetail,
            event.processedAt,
            event.registeredAt,
            event.updatedAt
        );
    }

    serialize(): IScheduleEvent {
        return {
            scheduleEventId: this.scheduleEventId,
            scheduleEventType: this.scheduleEventType,
            scheduleEventName: this.scheduleEventName,
            scheduleTimeSpan: this.scheduleTimeSpan,
            scheduleEventDetail: this.scheduleEventDetail,
            processedAt: this.processedAt,
            registeredAt: this.registeredAt,
            updatedAt: this.updatedAt
        } as IScheduleEvent;
    }

    equals(another: IScheduleEvent): boolean {
        return this._eventId === another.scheduleEventId;
    }

    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): IScheduleEvent {
        this._timeSpan = newTimeSpan;
        return this;
    }

    updateEventDetail(newEventDetail: TransitionPageDetail): IScheduleEvent {
        this._eventDetail = newEventDetail;
        return this;
    }

    updateEventName(newEventName: string): IScheduleEvent {
        this._eventName = newEventName;
        return this;
    }

    markAsProcessed(processedAt: Date = new Date()): IScheduleEvent {
        this._processedAt = processedAt;
        return this;
    }

    get scheduleEventId(): string {
        return this._eventId;
    }

    get scheduleEventType(): string {
        return "TransitionPageEvent";
    }

    get scheduleEventName(): string {
        return this._eventName;
    }

    get scheduleTimeSpan(): ScheduleTimeSpan {
        return this._timeSpan;
    }

    get processedAt(): Date | null {
        return this._processedAt;
    }

    get scheduleEventDetail(): TransitionPageDetail {
        return this._eventDetail;
    }

    get registeredAt(): Date {
        return this._registeredAt;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }
}

export class TransitionPageDetail {
    readonly transitionUrl: string;

    constructor(transitionUrl: string) {
        this.transitionUrl = transitionUrl;
    }
}