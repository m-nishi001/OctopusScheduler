import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "./i-schedule-event-converter";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { ShowContentEvent } from "../../domains/schedule-event/show-content-event";

@injectable()
export class ShowContentEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "ShowContentEvent";
  }

  canRevive(raw: any): boolean {
    return raw && raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return new ShowContentEvent(raw as any);
  }
}
