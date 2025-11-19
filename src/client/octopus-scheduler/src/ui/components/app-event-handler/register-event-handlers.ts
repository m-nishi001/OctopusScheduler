import type { Router } from "vue-router";
import { PlayAudioEventHandler } from "./play-audio-event-handler";
import { ShowContentEventHandler } from "./show-content/show-content-event-handler";
import { SlideshowEventHandler } from "./slideshow-event-handler";
import { TransitionPageEventHandler } from "./transition-page-event-handler";

export function registerEventHandlers(router: Router) {
  PlayAudioEventHandler.register();
  ShowContentEventHandler.register(router);
  SlideshowEventHandler.register(router);
  TransitionPageEventHandler.register(router);
}
