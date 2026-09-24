import type { PlayAudioEventData } from "./play-audio/play-audio-event-data";
import type { ShowContentEventData } from "./show-content/show-content-event-data";
import type { SlideshowEventData } from "./slideshow/slideshow-event-data";
import type { StopAudioEventData } from "./stop-audio/stop-audio-event-data";
import type { TransitionPageEventData } from "./transition/transition-page-event-data";

export type AppEventData =
  | PlayAudioEventData
  | ShowContentEventData
  | SlideshowEventData
  | StopAudioEventData
  | TransitionPageEventData;
