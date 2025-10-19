import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "./i-schedule-event-converter";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { SlideshowEvent } from "../../domains/schedule-event/slideshow-event";

@injectable()
export class SlideshowEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "SlideshowEvent";
  }

  canRevive(raw: any): boolean {
    return raw && raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return new SlideshowEvent(raw as any);
  }
}
