import { injectable } from "tsyringe";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";
import type { IScheduleEvent } from "../schedule-event";

@injectable()
export class PlayMovieEvent implements IScheduleEvent {

    static readonly scheduleEventTypeName: string = "PlayMovieEvent";

    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;
    private _scheduleEventDetail: PlayMovieEventDetail;

    public constructor() {
        this._scheduleEventId = "";
        this._scheduleEventName = "";
        this._scheduleTimespan = ScheduleTimeSpan.Empty;
        this._scheduleEventDetail = new PlayMovieEventDetail("");
        this._processedAt = null;
        this._registeredAt = new Date();
        this._updatedAt = new Date();
    }


    static from(another: IScheduleEvent, scheduleEventId?: string): PlayMovieEvent | null {
        const instance = new PlayMovieEvent();
        instance._scheduleEventId = scheduleEventId ?? another.scheduleEventId;
        instance._scheduleEventName = another.scheduleEventName;
        instance._scheduleTimespan = ScheduleTimeSpan.create(new Date(another.scheduleTimeSpan.start), new Date(another.scheduleTimeSpan.end))!;
        instance._scheduleEventDetail = another.scheduleEventDetail;
        instance._processedAt = new Date(another.processedAt ?? "");
        instance._registeredAt = new Date(another.registeredAt);
        instance._updatedAt = new Date(another.updatedAt);
        return instance;
    }

    serialize(): IScheduleEvent {
        return {
            scheduleEventId: this._scheduleEventId,
            scheduleEventType: PlayMovieEvent.scheduleEventTypeName,
            scheduleEventName: this._scheduleEventName,
            scheduleTimeSpan: this._scheduleTimespan,
            scheduleEventDetail: this._scheduleEventDetail,
            processedAt: this._processedAt,
            registeredAt: this._registeredAt,
            updatedAt: this._updatedAt
        } as IScheduleEvent;
    }

    executeScheduleEvent(): void {
        // TODO: 後で実装する。
    }

    equals(another: IScheduleEvent): boolean {
        return this._scheduleEventId === another.scheduleEventId;
    }

    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): void {
        this._scheduleTimespan = newTimeSpan;
    }

    updateEventDetail(newEventDetail: PlayMovieEventDetail): void {
        this._scheduleEventDetail = newEventDetail;
    }

    updateEventName(newEventName: string): void {
        this._scheduleEventName = newEventName;
    }

    markAsProcessed(processedAt: Date = new Date()): void {
        this._processedAt = processedAt;
    }

    get scheduleEventId(): string {
        return this._scheduleEventId;
    }

    get scheduleEventType(): string {
        return PlayMovieEvent.scheduleEventTypeName;
    }

    get scheduleEventName(): string {
        return this._scheduleEventName;
    }

    get scheduleTimeSpan(): ScheduleTimeSpan {
        return this._scheduleTimespan;
    }

    get processedAt(): Date | null {
        return this._processedAt;
    }

    get scheduleEventDetail(): any {
        return this._scheduleEventDetail;
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
    readonly fadeOutDuration?: number;

    constructor(movieId: string, fadeOutDuration?: number) {
        this.movieId = movieId;
        this.fadeOutDuration = fadeOutDuration;
    }
}