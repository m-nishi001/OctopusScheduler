import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "../i-schedule-event-converter";
import type { IScheduleEvent } from "../schedule-event";
import { ShowContentEvent } from "./show-content-event";
import type { ShowContentEventRaw } from "./show-content-event";

@injectable()
export class ShowContentEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "ShowContentEvent";
  }

  canRevive(raw: IScheduleEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return ShowContentEvent.revive(raw as unknown as ShowContentEventRaw);
  }
}
