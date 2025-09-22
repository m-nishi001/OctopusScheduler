import { IScheduleEvent } from "../schedule-event";
import { ScheduleTimeSpan } from "../../value-object/schedule-timespan";

export class PlayAudioEvent implements IScheduleEvent {

    static readonly scheduleEventType = "PlayAudioEvent";

    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;
    private _startedAt: Date | null = null;
    private _endedAt: Date | null = null;

    // 独自のプロパティ
    private _scheduleEventDetail: PlayAudioEventDetail;

    private constructor(
        scheduleEventId: string,
        scheduleEventName: string,
        scheduleTimespan: ScheduleTimeSpan,
        scheduleEventDetail: PlayAudioEventDetail,
        processedAt: Date | null,
        registeredAt: Date,
        updatedAt: Date,
        startedAt?: Date | null,
        endedAt?: Date | null
    ) {
        this._scheduleEventId = scheduleEventId;
        this._scheduleEventName = scheduleEventName;
        this._scheduleTimespan = scheduleTimespan;
        this._scheduleEventDetail = scheduleEventDetail;
        this._processedAt = processedAt;
        this._registeredAt = registeredAt;
        this._updatedAt = updatedAt;
        this._startedAt = startedAt ?? null;
        this._endedAt = endedAt ?? null;
    }

    static from(event: IScheduleEvent): PlayAudioEvent | null {
        if (!event || !event.scheduleEventName) {
            console.log(`[PlayAudioEvent.create] event or eventName is invalid.`);
            return null;
        }
        return new PlayAudioEvent(
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
        return this._scheduleEventId === another.scheduleEventId;
    }

    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): IScheduleEvent {
        this._scheduleTimespan = newTimeSpan;
        return this;
    }

    updateEventDetail(newEventDetail: PlayAudioEventDetail): IScheduleEvent {
        this._scheduleEventDetail = newEventDetail;
        return this;
    }

    updateEventName(newEventName: string): IScheduleEvent {
        this._scheduleEventName = newEventName;
        return this;
    }

    markAsProcessed(processedAt: Date = new Date()): IScheduleEvent {
        this._processedAt = processedAt;
        return this;
    }

    get scheduleEventId(): string {
        return this._scheduleEventId;
    }

    get scheduleEventType(): string {
        return "PlayAudioEvent";
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

    get scheduleEventDetail(): PlayAudioEventDetail {
        return this._scheduleEventDetail;
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

export class PlayAudioEventDetail {
    readonly audioId: string;

    constructor(audioId: string) {
        this.audioId = audioId;
    }
}