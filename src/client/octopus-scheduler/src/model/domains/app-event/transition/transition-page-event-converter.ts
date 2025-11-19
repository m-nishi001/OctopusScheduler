import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { TransitionPageEvent } from "./transition-page-event";

@injectable()
export class TransitionPageEventConverter implements IAppEventConverter {
  getType(): string {
    return "TransitionPageEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return TransitionPageEvent.revive(raw);
  }
}
