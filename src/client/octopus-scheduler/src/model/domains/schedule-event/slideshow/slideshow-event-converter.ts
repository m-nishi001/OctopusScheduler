import { injectable } from "tsyringe";
import type { IScheduleEventConverter } from "../i-schedule-event-converter";
import type { IScheduleEvent } from "../schedule-event";
import { SlideshowEvent } from "./slideshow-event";
import type { SlideshowEventRaw } from "./slideshow-event";

@injectable()
export class SlideshowEventConverter implements IScheduleEventConverter {
  getType(): string {
    return "SlideshowEvent";
  }

  canRevive(raw: IScheduleEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IScheduleEvent): IScheduleEvent {
    return SlideshowEvent.revive(raw as unknown as SlideshowEventRaw);
  }
}
