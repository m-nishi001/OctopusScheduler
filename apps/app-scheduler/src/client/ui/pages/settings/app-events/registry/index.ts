import type { UIActionEntry } from "../ui-action-entry";
import { TransitionPageAction } from "../events/transition-page/entry";
import { AudioAction } from "../events/audio/entry";
import { ScreenAction } from "../events/screen/entry";

// Plain, UI-owned list of available app-event actions for settings forms.
// Not DI-registered: this never varies by environment/backend, so there is
// no need for the indirection a DI token would add.
export const uiActionEntries: UIActionEntry[] = [AudioAction, ScreenAction, TransitionPageAction];

export default uiActionEntries;
