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

  toEntity?(dto: Record<string, any>): IAppEvent {
    return PlayAudioEvent.fromData(dto as Record<string, any>);
  }

  toDto?(entity: IAppEvent): Record<string, any> {
    // include actionType for UI and serialized object
    // @ts-ignore - entity may implement serializeAsObject
    const obj = (entity as any).serializeAsObject
      ? (entity as any).serializeAsObject()
      : {};
    return { actionType: (entity as any).type, ...obj };
  }

  validate?(data: Record<string, any>) {
    if (!data || !data.audioId) {
      alert("音声IDを入力してください");
      return false;
    }
    return true;
  }

  getFormComponent?() {
    return null;
  }
}
