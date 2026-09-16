import StopAudioForm from "./stop-audio-form.vue";
import type { UIActionEntry } from "../../app-events/ui-action-entry";

export const StopAudioAction: UIActionEntry = {
  actionType: "StopAudioEvent",
  label: "音楽停止",
  component: StopAudioForm,
  defaultData: (action?: any) => ({
    actionType: "StopAudioEvent",
    fadeOutDuration: action?.fadeOutDuration ?? 0,
  }),
};

export default StopAudioAction;
