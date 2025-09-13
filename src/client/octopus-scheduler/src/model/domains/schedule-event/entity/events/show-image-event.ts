import { injectable } from "tsyringe";
import type { IScheduleEventType } from "../../vo/event-types/event-type";
import { PlayAudioEventType } from "../../vo/event-types/events/play-audio-event-type";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";
import type { IScheduleEvent } from "../schedule-event";

@injectable()
export class ShowImageEvent implements IScheduleEvent {
    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;

    // 独自のプロパティ
    private _scheduleEventDetail: ShowImageEventDetail;

        public constructor() {
            this._scheduleEventId = "";
            this._scheduleEventName = "";
            this._scheduleTimespan = ScheduleTimeSpan.Empty;
            this._scheduleEventDetail = new ShowImageEventDetail("");
            this._processedAt = null;
            this._registeredAt = new Date();
            this._updatedAt = new Date();
        }

    static create(eventName: string): ShowImageEvent | null {
        if (eventName === "") {
            console.log(`[ShowImageEvent.create] eventName is empty.`);
            return null;
        }
        const instance = new ShowImageEvent();
        instance._scheduleEventId = "";
        instance._scheduleEventName = eventName;
        instance._scheduleTimespan = ScheduleTimeSpan.Empty;
        instance._scheduleEventDetail = new ShowImageEventDetail("");
        instance._processedAt = null;
        instance._registeredAt = new Date();
        instance._updatedAt = new Date();
        return instance;
    }

    static from(event: IScheduleEvent): ShowImageEvent | null {
        const instance = new ShowImageEvent();
        instance._scheduleEventId = event.scheduleEventId;
        instance._scheduleEventName = event.scheduleEventName;
        instance._scheduleTimespan = event.scheduleTimeSpan;
        instance._scheduleEventDetail = new ShowImageEventDetail(event.scheduleEventDetail.movieId ?? "");
        instance._processedAt = event.processedAt;
        instance._registeredAt = event.registeredAt;
        instance._updatedAt = event.updatedAt;
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

    updateEventDetail(newEventDetail: ShowImageEventDetail): void {
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

export class ShowImageEventDetail {
    readonly imageId: string;

    constructor(imageId: string) {
        this.imageId = imageId;
    }
}