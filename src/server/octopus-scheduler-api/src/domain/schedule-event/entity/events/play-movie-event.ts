import { IScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";
import { IScheduleEventType } from "../../value-object/event-types/event-type";

export class PlayMovieEvent implements IScheduleEvent {
    private _eventId: string;
    private _eventName: string;
    private _timeSpan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;

    // 独自のプロパティ
    private _eventDetail: PlayMovieEventDetail;

    private constructor(
        eventId: string,
        eventName: string,
        timeSpan: ScheduleTimeSpan,
        eventDetail: PlayMovieEventDetail,
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

    static create(eventName: string): PlayMovieEvent | null {
        if (eventName === "") {
            console.log(`[PlayMovieEvent.create] eventName is empty.`);
            return null;
        }

        return new PlayMovieEvent(
            Utilities.getUuid(),
            eventName,
            ScheduleTimeSpan.Empty,
            new PlayMovieEventDetail(""),
            null,
            new Date(),
            new Date()
        );
    }

    static createByClient(source: IScheduleEvent): PlayMovieEvent | null {
        return new PlayMovieEvent(
            Utilities.getUuid(),
            source.scheduleEventName,
            source.scheduleTimeSpan,
            source.scheduleEventDetail,
            source.processedAt,
            source.registeredAt,
            source.updatedAt
        );
    }

    static from(another: IScheduleEvent): PlayMovieEvent | null {
        return new PlayMovieEvent(
            another.scheduleEventId,
            another.scheduleEventName,
            another.scheduleTimeSpan,
            another.scheduleEventDetail,
            another.processedAt,
            another.registeredAt,
            another.updatedAt
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

    updateEventDetail(newEventDetail: PlayMovieEventDetail): IScheduleEvent {
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
        return {
            scheduleEventType: "PlayMovieEvent",
            displayName: "映像再生イベント",
            displayDescription: "指定した映像を再生します。",
            createEvent: () => null
        };
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

export class PlayMovieEventDetail {
    readonly movieId: string;

    constructor(movieId: string) {
        this.movieId = movieId;
    }
}