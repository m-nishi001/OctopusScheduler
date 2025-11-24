import ShowContentForm from "./show-content-form.vue";
import type { UIActionEntry } from "../../app-events/ui-action-entry";

export const ShowContentAction: UIActionEntry = {
  actionType: "ShowContentEvent",
  label: "コンテンツ表示",
  component: ShowContentForm,
  defaultData: (action?: any) => ({
    actionType: "ShowContentEvent",
    contentType: action?.contentType,
    contentId: action?.contentId,
  }),
};

export default ShowContentAction;
