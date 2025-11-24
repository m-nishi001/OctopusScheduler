import TransitionPageForm from './transition-page-form.vue';
import type { UIActionEntry } from '../../app-events/ui-action-entry';

export const TransitionPageAction: UIActionEntry = {
  actionType: 'TransitionPageEvent',
  label: '画面遷移',
  component: TransitionPageForm,
  defaultData: (action?: any) => ({ transitionUrl: action?.transitionUrl }),
};

export default TransitionPageAction;
