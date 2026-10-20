import PlayAudioForm from "./play-audio-form.vue";
import type { UIActionEntry } from "../../ui-action-entry";

export const PlayAudioAction: UIActionEntry = {
  actionType: "PlayAudioEvent",
  label: "音楽再生",
  component: PlayAudioForm,
  defaultData: (action?: any) => ({
    actionType: "PlayAudioEvent",
    audioId: action?.audioId,
  }),
};

export default PlayAudioAction;
