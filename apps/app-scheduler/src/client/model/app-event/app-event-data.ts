import type { AudioEventData } from "./audio/audio-event-data";
import type { ScreenEventData } from "./screen/screen-event-data";
import type { TransitionPageEventData } from "./transition/transition-page-event-data";

export type AppEventData = AudioEventData | ScreenEventData | TransitionPageEventData;
