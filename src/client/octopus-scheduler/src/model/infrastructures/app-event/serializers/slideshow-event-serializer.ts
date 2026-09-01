import { injectable } from "tsyringe";
import type { IEventSerializer } from "../../../domains/app-event/i-event-serializer";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { SlideshowEvent } from "../../../domains/app-event/slideshow/slideshow-event";

@injectable()
export class SlideshowEventSerializer implements IEventSerializer {
  getType(): string {
    return "SlideshowEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return SlideshowEvent.revive(raw);
  }
}
