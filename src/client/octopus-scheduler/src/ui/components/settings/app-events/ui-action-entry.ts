import type { Component } from "vue";
import type { IAppEventDto } from "../../../../model/applications/app-event/i-app-event-dto";

export interface UIActionEntry {
  actionType: string;
  label: string;
  component?: Component | any;
  // defaultData should return a full IAppEventDto
  defaultData?: (action?: any) => IAppEventDto;
}

export default {} as UIActionEntry;
