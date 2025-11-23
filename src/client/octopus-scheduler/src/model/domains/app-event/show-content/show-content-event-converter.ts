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

  toEntityFromForm?(form: Record<string, any>): IAppEvent {
    return ShowContentEvent.fromData(form as Record<string, any>);
  }

  getInitial?(action?: any) {
    return { contentType: action?.contentType ?? "", contentId: action?.contentId ?? "" };
  }

  validate?(data: Record<string, any>) {
    if (!data || !data.contentId) {
      alert("コンテンツIDを入力してください");
      return false;
    }
    return true;
  }

  getFormComponent?() {
    return null;
  }
}
