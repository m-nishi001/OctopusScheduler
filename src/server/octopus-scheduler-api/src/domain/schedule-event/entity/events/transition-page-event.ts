import { IScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";
import { IScheduleEventType } from "../../value-object/event-types/event-type";
import { PlayAudioEventType } from "../../value-object/event-types/events/play-audio-event-type";

export class TransitionPageEvent implements IScheduleEvent {
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

    static create(eventName: string): TransitionPageEvent | null {
        if (eventName === "") {
            console.log(`[TransitionPageEvent.create] eventName is empty.`);
            return null;
        }

        return new TransitionPageEvent(
            Utilities.getUuid(),
            eventName,
            ScheduleTimeSpan.Empty,
            new TransitionPageDetail(""),
            null,
            new Date(),
            new Date()
        );
    }

    static createByClient(source: IScheduleEvent): TransitionPageEvent | null {
        return new TransitionPageEvent(
            Utilities.getUuid(),
            source.scheduleEventName,
            source.scheduleTimeSpan,
            source.scheduleEventDetail,
            source.processedAt,
            source.registeredAt,
            source.updatedAt
        );
    }

    static from(event: IScheduleEvent): TransitionPageEvent | null {
        return new TransitionPageEvent(
            event.scheduleEventId,
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

    get scheduleEventType(): IScheduleEventType {
        return new PlayAudioEventType();
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

    get scheduleEventDetail(): any {
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