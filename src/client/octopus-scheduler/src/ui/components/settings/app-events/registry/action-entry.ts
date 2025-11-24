export interface ActionEntry<TData = any, TEvent = any> {
  actionType: string;
  label?: string;
  component?: any; // Vue component
  getDefault: () => TData;
  toDto: (event: TEvent) => TData;
  toEntity: (id: string, now: Date, data: TData) => TEvent;
  validate?: (data: TData) => boolean;
}

export default {} as ActionEntry;
