import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";

export const IScheduleEventConverterToken = Symbol("IScheduleEventConverter");

export interface IScheduleEventConverter {
  getType(): string;
  canRevive(raw: any): boolean;
  revive(raw: IScheduleEvent): IScheduleEvent;
}
