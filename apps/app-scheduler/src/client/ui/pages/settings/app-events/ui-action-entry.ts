import type { Component } from "vue";
import type { AppEventDto } from "../../../../control/app-event/dto/app-event-dto";

export interface UIActionEntry {
  actionType: AppEventDto["actionType"];
  label: string;
  component: Component;
  defaultData: (action?: any) => AppEventDto;
}

// Contract every app-event settings form (`*-form.vue`) must expose. `save()`
// triggers the form's own validation/upload and emits its `save` event with
// the resulting dto rather than returning it directly.
export interface EventFormHandle {
  save(): void | Promise<void>;
  reset(): void;
}

export default {} as UIActionEntry;
