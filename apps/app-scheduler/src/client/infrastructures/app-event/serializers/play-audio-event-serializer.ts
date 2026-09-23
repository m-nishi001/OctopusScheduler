import { injectable } from "tsyringe";
import type { IEventSerializer } from "../../../domains/app-event/i-event-serializer";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { PlayAudioEvent } from "../../../domains/app-event/play-audio/play-audio-event";

@injectable()
export class PlayAudioEventSerializer implements IEventSerializer {
  getType(): string {
    return "PlayAudioEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return PlayAudioEvent.revive(raw);
  }
}
