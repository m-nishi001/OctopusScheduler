import { injectable } from "tsyringe";
import { ScheduleTimeSpan } from "../../vo/schedule-timespan";
import type { IScheduleEvent } from "../schedule-event";

@injectable()
export class TransitionPageEvent implements IScheduleEvent {

    static readonly scheduleEventTypeName: string = "TransitionPageEvent";

    private _scheduleEventId: string;
    private _scheduleEventName: string;
    private _scheduleTimespan: ScheduleTimeSpan;
    private _processedAt: Date | null;
    private _registeredAt: Date;
    private _updatedAt: Date;
    private _scheduleEventDetail: TransitionPageDetail;

    public constructor() {
        this._scheduleEventId = "";
        this._scheduleEventName = "";
        this._scheduleTimespan = ScheduleTimeSpan.Empty;
        this._scheduleEventDetail = new TransitionPageDetail("");
        this._processedAt = null;
        this._registeredAt = new Date();
        this._updatedAt = new Date();
    }


    static from(event: IScheduleEvent, scheduleEventId?: string): TransitionPageEvent | null {
        const instance = new TransitionPageEvent();
        instance._scheduleEventId = scheduleEventId ?? event.scheduleEventId;
        instance._scheduleEventName = event.scheduleEventName;
        instance._scheduleTimespan = ScheduleTimeSpan.create(new Date(event.scheduleTimeSpan.start), new Date(event.scheduleTimeSpan.end))!;
        instance._scheduleEventDetail = event.scheduleEventDetail;
        instance._processedAt = new Date(event.processedAt ?? "");
        instance._registeredAt = new Date(event.registeredAt);
        instance._updatedAt = new Date(event.updatedAt);
        return instance;
    }

    serialize(): IScheduleEvent {
        return {
            scheduleEventId: this._scheduleEventId,
            scheduleEventType: TransitionPageEvent.scheduleEventTypeName,
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

    updateEventDetail(newEventDetail: TransitionPageDetail): void {
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
        return TransitionPageEvent.scheduleEventTypeName;
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

export class TransitionPageDetail {
    readonly transitionUrl: string;
    readonly fadeOutDuration?: number;

    constructor(transitionUrl: string, fadeOutDuration?: number) {
        this.transitionUrl = transitionUrl;
        this.fadeOutDuration = fadeOutDuration;
    }
}