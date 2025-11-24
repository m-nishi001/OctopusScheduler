import PlayAudioForm from './play-audio-form.vue';
import type { UIActionEntry } from '../../app-events/ui-action-entry';

export const PlayAudioAction: UIActionEntry = {
  actionType: 'PlayAudioEvent',
  label: '音声再生',
  component: PlayAudioForm,
  defaultData: (action?: any) => ({ audioId: action?.audioId }),
};

export default PlayAudioAction;
