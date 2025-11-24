import SlideshowForm from './slideshow-form.vue';
import type { UIActionEntry } from '../../app-events/ui-action-entry';

export const SlideshowAction: UIActionEntry = {
  actionType: 'SlideshowEvent',
  label: 'スライドショー',
  component: SlideshowForm,
  defaultData: (action?: any) => ({
    folderId: action?.folderId,
    displayDuration: action?.displayDuration,
  }),
};

export default SlideshowAction;
