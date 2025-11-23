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

  toEntityFromForm?(form: Record<string, any>): IAppEvent {
    return SlideshowEvent.fromData(form as Record<string, any>);
  }

  getInitial?(action?: any) {
    return { folderId: action?.folderId ?? "", displayDuration: action?.displayDuration ?? 5 };
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
