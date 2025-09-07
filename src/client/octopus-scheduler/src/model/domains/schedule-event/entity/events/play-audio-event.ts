import type { IScheduleEventType } from "../../vo/event-types/event-type";
import { PlayAudioEventType } from "../../vo/event-types/events/play-audio-event-type";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";
import type { IScheduleEvent } from "../schedule-event";

export class PlayAudioEvent implements IScheduleEvent {
    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;

    // 独自のプロパティ
    private _scheduleEventDetail: PlayAudioEventDetail;

    private constructor(
        eventId: string,
        eventName: string,
        timeSpan: ScheduleTimeSpan,
        eventDetail: PlayAudioEventDetail,
        processedAt: Date | null,
        registeredAt: Date,
        updatedAt: Date
    ) {
        this._scheduleEventId = eventId;
        this._scheduleEventName = eventName;
        this._scheduleTimespan = timeSpan;
        this._scheduleEventDetail = eventDetail;
        this._processedAt = processedAt;
        this._registeredAt = registeredAt;
        this._updatedAt = updatedAt;
    }

    static create(eventName: string): PlayAudioEvent | null {
        if (eventName === "") {
            console.log(`[PlayAudioEvent.create] eventName is empty.`);
            return null;
        }

        return new PlayAudioEvent(
            "", // サーバー側でIDを採番するため空文字をセット
            eventName,
            ScheduleTimeSpan.Empty,
            new PlayAudioEventDetail(""),
            null,
            new Date(),
            new Date()
        );
    }

    static from(another: IScheduleEvent): PlayAudioEvent | null {
        return new PlayAudioEvent(
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
            scheduleEventId: this._scheduleEventId,
            scheduleEventType: this.scheduleEventType,
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

    get scheduleEventType(): IScheduleEventType {
        return new PlayAudioEventType();
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

export class PlayAudioEventDetail {
    readonly audioId: string;

    constructor(audioId: string) {
        this.audioId = audioId;
    }
}