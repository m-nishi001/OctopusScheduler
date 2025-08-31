import { domainEventBus } from "../../../event-bus";
import type { IEventDetail } from "./event-detail";

export class ImageDetail implements IEventDetail {
    constructor(
        public readonly imageID: string,
        public readonly fadeInMs: number,
        public readonly fadeOutMs: number,
    ) {
        if (fadeInMs < 0 || fadeOutMs < 0) {
            throw new Error('フェードイン、フェードアウト時間は0以上である必要があります。');
        }
    }

    public execute(): void {
        domainEventBus.emit('image-display', this);
    }
}