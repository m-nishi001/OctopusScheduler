import type { Component } from "vue";
import type { AppEventDto } from "../../../../control/app-event/dto/app-event-dto";

export interface UIActionEntry {
  actionType: string;
  label: string;
  component?: Component | any;
  // defaultData should return a full AppEventDto
  defaultData?: (action?: any) => AppEventDto;
}

export default {} as UIActionEntry;
