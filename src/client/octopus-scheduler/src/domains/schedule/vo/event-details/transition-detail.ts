import { domainEventBus } from "../../../event-bus";
import type { IEventDetail } from "./event-detail";

export class TransitionDetail implements IEventDetail {
    constructor(
        public readonly destinationURL: URL,
    ) { }

    public execute(): void {
        domainEventBus.emit('transition-redirect', this);
    }
}