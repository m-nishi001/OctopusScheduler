import { PlayAudioEventHandler } from "./play-audio-event-handler";
import { ShowContentEventHandler } from "./show-content/show-content-event-handler";
import { TransitionPageEventHandler } from "./transition-page-event-handler";

export function registerEventHandlers(
  audio: any,
  assetService: any,
  router: any
) {
  PlayAudioEventHandler.register(audio, assetService);
  ShowContentEventHandler.register(router);
  TransitionPageEventHandler.register(router);
}
