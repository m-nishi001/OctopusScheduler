import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "../i-schedule-event-converter";
import type { IScheduleEvent } from "../schedule-event";
import { TransitionPageEvent } from "./transition-page-event";

@injectable()
export class TransitionPageEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "TransitionPageEvent";
  }

  canRevive(raw: IScheduleEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return TransitionPageEvent.revive(raw);
  }
}
