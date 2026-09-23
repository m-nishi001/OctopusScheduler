import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { StopAudioEvent } from "./stop-audio-event";

@injectable()
export class StopAudioEventConverter implements IAppEventConverter {
  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent | null {
    return StopAudioEvent.revive(raw);
  }

  fromData(dto: Record<string, any>): IAppEvent {
    return StopAudioEvent.fromData(dto);
  }

  getType(): string {
    return "StopAudioEvent";
  }
}
