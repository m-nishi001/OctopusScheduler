import AudioForm from "./audio-form.vue";
import type { UIActionEntry } from "../../ui-action-entry";

export const AudioAction: UIActionEntry = {
  actionType: "AudioEvent",
  label: "音楽",
  component: AudioForm,
  defaultData: (action?: any) => ({
    actionType: "AudioEvent",
    audioId: action?.audioId ?? "",
    fadeOutSec: action?.fadeOutSec ?? 0,
  }),
};

export default AudioAction;
