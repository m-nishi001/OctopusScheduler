import { injectable } from "tsyringe";
import type { IEventSerializer } from "../../../domains/app-event/i-event-serializer";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { TransitionPageEvent } from "../../../domains/app-event/transition/transition-page-event";

@injectable()
export class TransitionPageEventSerializer implements IEventSerializer {
  getType(): string {
    return "TransitionPageEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return TransitionPageEvent.revive(raw);
  }
}
