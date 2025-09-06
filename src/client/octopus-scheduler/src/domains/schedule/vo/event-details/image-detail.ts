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

    public static from(obj: unknown): ImageDetail {
        if (obj instanceof ImageDetail) return obj;
        const plain = obj as Record<string, unknown> | undefined;
        const imageID = (plain?.imageID ?? plain?.imageId ?? plain?.id ?? "") as string;
        const fadeInMs = typeof plain?.fadeInMs === 'number' ? (plain!.fadeInMs as number) : Number(plain?.fadeInMs ?? 0);
        const fadeOutMs = typeof plain?.fadeOutMs === 'number' ? (plain!.fadeOutMs as number) : Number(plain?.fadeOutMs ?? 0);
        return new ImageDetail(imageID, fadeInMs, fadeOutMs);
    }
}