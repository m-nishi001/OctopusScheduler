import type { UIActionEntry } from "../ui-action-entry";
import { TransitionPageAction } from "../events/transition-page/entry";
import { PlayAudioAction } from "../events/play-audio/entry";
import { StopAudioAction } from "../events/stop-audio/entry";
import { SlideshowAction } from "../events/slideshow/entry";
import { ShowContentAction } from "../events/show-content/entry";

// Plain, UI-owned list of available app-event actions for settings forms.
// Not DI-registered: this never varies by environment/backend, so there is
// no need for the indirection a DI token would add.
export const uiActionEntries: UIActionEntry[] = [
  TransitionPageAction,
  PlayAudioAction,
  StopAudioAction,
  SlideshowAction,
  ShowContentAction,
];

export default uiActionEntries;
