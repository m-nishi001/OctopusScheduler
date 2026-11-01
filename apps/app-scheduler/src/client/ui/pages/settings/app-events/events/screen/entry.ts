import ScreenForm from "./screen-form.vue";
import type { UIActionEntry } from "../../ui-action-entry";

export const ScreenAction: UIActionEntry = {
  actionType: "ScreenEvent",
  label: "スクリーン",
  component: ScreenForm,
  defaultData: (action?: any) => ({
    actionType: "ScreenEvent",
    spec: action?.spec ?? { kind: "image", id: "" },
  }),
};

export default ScreenAction;
