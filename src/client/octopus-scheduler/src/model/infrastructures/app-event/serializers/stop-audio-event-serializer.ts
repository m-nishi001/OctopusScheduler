import { injectable } from "tsyringe";
import type { IEventSerializer } from "../../../domains/app-event/i-event-serializer";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { StopAudioEvent } from "../../../domains/app-event/stop-audio/stop-audio-event";

@injectable()
export class StopAudioEventSerializer implements IEventSerializer {
  getType(): string {
    return "StopAudioEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return StopAudioEvent.revive(raw);
  }
}
