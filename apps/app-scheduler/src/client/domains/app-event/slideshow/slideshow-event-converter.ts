import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { SlideshowEvent } from "./slideshow-event";

@injectable()
export class SlideshowEventConverter implements IAppEventConverter {
  getType(): string {
    return "SlideshowEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return SlideshowEvent.revive(raw);
  }

  toEntity?(dto: Record<string, any>): IAppEvent {
    return SlideshowEvent.fromData(dto as Record<string, any>);
  }

  toDto?(entity: IAppEvent): Record<string, any> {
    // @ts-ignore
    const obj = (entity as any).serializeAsObject
      ? (entity as any).serializeAsObject()
      : {};
    return { actionType: (entity as any).type, ...obj };
  }

  validate?(data: Record<string, any>) {
    if (!data || !data.folderId || !data.displayDuration) {
      alert("フォルダIDと表示時間を入力してください");
      return false;
    }
    return true;
  }

  getFormComponent?() {
    return null;
  }
}
