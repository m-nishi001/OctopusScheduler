import type { TimeSpan } from "../vo/timespan";
import type { IEventDetail } from "../vo/event-details/event-detail";

export interface IEvent {
    readonly id: string;
    getEventName(): string;
    changeEventName(name: string): void;
    getTimeSpan(): TimeSpan;
    updateTimeSpan(timeSpan: TimeSpan): void;
    getDetail(): IEventDetail;
    clone(newId: string): IEvent;
    execute(): void;
}