import type { Component } from 'vue';

export interface UIActionEntry {
  actionType: string;
  label: string;
  component?: Component | any;
  defaultData?: (action?: any) => any;
}

export default {} as UIActionEntry;
