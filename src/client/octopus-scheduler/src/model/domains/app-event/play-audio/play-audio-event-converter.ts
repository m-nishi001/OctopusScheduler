import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { PlayAudioEvent } from "./play-audio-event";

@injectable()
export class PlayAudioEventConverter implements IAppEventConverter {
  getType(): string {
    return "PlayAudioEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return PlayAudioEvent.revive(raw);
  }
}
