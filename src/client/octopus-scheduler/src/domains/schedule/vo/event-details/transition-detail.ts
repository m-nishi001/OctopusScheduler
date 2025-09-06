import { domainEventBus } from "../../../event-bus";
import type { IEventDetail } from "./event-detail";

export class TransitionDetail implements IEventDetail {
    constructor(
        public readonly destinationURL: URL,
    ) { }

    public execute(): void {
        domainEventBus.emit('transition-redirect', this);
    }

    public static from(obj: unknown): TransitionDetail {
        if (obj instanceof TransitionDetail) return obj;
        if (obj === undefined || obj === null) throw new Error('Invalid TransitionDetail');
        if (obj instanceof URL) return new TransitionDetail(obj);
        if (typeof obj === 'string') return new TransitionDetail(new URL(obj));
        const plain = obj as Record<string, unknown>;
        const urlVal = ('destinationURL' in plain ? plain.destinationURL : ('destinationUrl' in plain ? plain.destinationUrl : ('url' in plain ? plain.url : undefined))) ?? plain;
        const url = urlVal instanceof URL ? urlVal : new URL(String(urlVal));
        return new TransitionDetail(url);
    }
}