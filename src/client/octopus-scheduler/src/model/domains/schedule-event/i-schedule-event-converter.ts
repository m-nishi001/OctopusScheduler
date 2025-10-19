import type { IScheduleEvent } from "./schedule-event";

export const IScheduleEventConverterToken = Symbol("IScheduleEventConverter");

export interface IScheduleEventConverter {
  getType(): string;
  canRevive(raw: IScheduleEvent): boolean;
  revive(raw: IScheduleEvent): IScheduleEvent;
}
