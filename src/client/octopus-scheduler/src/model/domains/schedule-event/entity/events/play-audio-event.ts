import { injectable } from "tsyringe";
import type { IScheduleEventType } from "../../vo/event-types/event-type";
import { PlayAudioEventType } from "../../vo/event-types/events/play-audio-event-type";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";
import type { IScheduleEvent } from "../schedule-event";

@injectable()
export class PlayAudioEvent implements IScheduleEvent {
    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;

    // 独自のプロパティ
    private _scheduleEventDetail: PlayAudioEventDetail;

    public constructor() {
        // 空の初期化（必要ならデフォルト値をセット）
        this._scheduleEventId = "";
        this._scheduleEventName = "";
        this._scheduleTimespan = ScheduleTimeSpan.Empty;
        this._scheduleEventDetail = new PlayAudioEventDetail("");
        this._processedAt = null;
        this._registeredAt = new Date();
        this._updatedAt = new Date();
    }

    static create(eventName: string): PlayAudioEvent | null {
        if (eventName === "") {
            console.log(`[PlayAudioEvent.create] eventName is empty.`);
            return null;
        }
        const instance = new PlayAudioEvent();
        instance._scheduleEventId = "";
        instance._scheduleEventName = eventName;
        instance._scheduleTimespan = ScheduleTimeSpan.Empty;
        instance._scheduleEventDetail = new PlayAudioEventDetail("");
        instance._processedAt = null;
        instance._registeredAt = new Date();
        instance._updatedAt = new Date();
        return instance;
    }

    static from(another: IScheduleEvent, scheduleEventId?: string): PlayAudioEvent | null {
        const instance = new PlayAudioEvent();
        instance._scheduleEventId = scheduleEventId ?? another.scheduleEventId;
        instance._scheduleEventName = another.scheduleEventName;
        instance._scheduleTimespan = another.scheduleTimeSpan;
        instance._scheduleEventDetail = another.scheduleEventDetail;
        instance._processedAt = another.processedAt;
        instance._registeredAt = another.registeredAt;
        instance._updatedAt = another.updatedAt;
        return instance;
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

    updateTimeSpan(newTimeSpan: ScheduleTimeSpan): void {
        this._scheduleTimespan = newTimeSpan;
    }

    updateEventDetail(newEventDetail: PlayAudioEventDetail): void {
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