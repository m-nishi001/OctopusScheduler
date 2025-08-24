import type { AudioDetail } from "./vo/event-details/audio-detail";
import type { ImageDetail } from "./vo/event-details/image-detail";
import type { VideoDetail } from "./vo/event-details/video-detail";
import type { TransitionDetail } from "./vo/event-details/transition-detail";

/**
 * イベント名とペイロードの型をマッピングする
 */
export type EventMap = {
    'audio-playback': AudioDetail;
    'image-display': ImageDetail;
    'video-playback': VideoDetail;
    'transition-redirect': TransitionDetail;
    'event-execution-completed': void;
};