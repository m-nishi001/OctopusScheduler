import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { ShowContentEvent } from "./show-content-event";

@injectable()
export class ShowContentEventConverter implements IAppEventConverter {
  getType(): string {
    return "ShowContentEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return ShowContentEvent.revive(raw);
  }
}
