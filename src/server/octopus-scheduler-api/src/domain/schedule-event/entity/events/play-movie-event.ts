import { IScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class PlayMovieEvent implements IScheduleEvent {

    static readonly scheduleEventType = "PlayMovieEvent";

    private _eventId: string;
    private _eventName: string;
    private _timeSpan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;
    private _startedAt: Date | null = null;
    private _endedAt: Date | null = null;

    // 独自のプロパティ
    private _eventDetail: PlayMovieEventDetail;

    private constructor(
        eventId: string,
        eventName: string,
        timeSpan: ScheduleTimeSpan,
        eventDetail: PlayMovieEventDetail,
        processedAt: Date | null,
        registeredAt: Date,
        updatedAt: Date,
        startedAt?: Date | null,
        endedAt?: Date | null
    ) {
        this._eventId = eventId;
        this._eventName = eventName;
        this._timeSpan = timeSpan;
        this._eventDetail = eventDetail;
        this._processedAt = processedAt;
        this._registeredAt = registeredAt;
        this._updatedAt = updatedAt;
        this._startedAt = startedAt ?? null;
        this._endedAt = endedAt ?? null;
    }

    static from(event: IScheduleEvent): PlayMovieEvent | null {
        if (!event || !event.scheduleEventName) {
            console.log(`[PlayMovieEvent.create] event or eventName is invalid.`);
            return null;
        }
        return new PlayMovieEvent(
            event.scheduleEventId === "" ? Utilities.getUuid() : event.scheduleEventId,
            event.scheduleEventName,
            event.scheduleTimeSpan,
            event.scheduleEventDetail,
            event.processedAt,
            event.registeredAt,
            event.updatedAt,
            event.startedAt ?? null,
            event.endedAt ?? null
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
            updatedAt: this.updatedAt,
            startedAt: this.startedAt,
            endedAt: this.endedAt
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

    get scheduleEventType(): string {
        return "PlayMovieEvent";
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

    get scheduleEventDetail(): PlayMovieEventDetail {
        return this._eventDetail;
    }

    get registeredAt(): Date {
        return this._registeredAt;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }
    get startedAt(): Date | null {
        return this._startedAt;
    }

    get endedAt(): Date | null {
        return this._endedAt;
    }

    markAsStarted(startedAt: Date): IScheduleEvent {
        this._startedAt = startedAt;
        return this;
    }

    markAsEnded(endedAt: Date): IScheduleEvent {
        this._endedAt = endedAt;
        return this;
    }
}

export class PlayMovieEventDetail {
    readonly movieId: string;

    constructor(movieId: string) {
        this.movieId = movieId;
    }
}