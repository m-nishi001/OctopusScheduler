import { injectable } from "tsyringe";
import type { IEventSerializer } from "../../../domains/app-event/i-event-serializer";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { ShowContentEvent } from "../../../domains/app-event/show-content/show-content-event";

@injectable()
export class ShowContentEventSerializer implements IEventSerializer {
  getType(): string {
    return "ShowContentEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return ShowContentEvent.revive(raw);
  }
}
