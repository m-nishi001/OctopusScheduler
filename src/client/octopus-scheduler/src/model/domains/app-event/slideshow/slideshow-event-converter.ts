import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { SlideshowEvent } from "./slideshow-event";

@injectable()
export class SlideshowEventConverter implements IAppEventConverter {
  getType(): string {
    return "SlideshowEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return SlideshowEvent.revive(raw);
  }
}
