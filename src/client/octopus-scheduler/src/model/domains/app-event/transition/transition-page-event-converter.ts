import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../app-event";
import { TransitionPageEvent } from "./transition-page-event";

@injectable()
export class TransitionPageEventConverter implements IAppEventConverter {
  getType(): string {
    return "TransitionPageEvent";
  }

  canRevive(raw: IAppEvent): boolean {
    return raw.type === this.getType();
  }

  revive(raw: IAppEvent): IAppEvent {
    return TransitionPageEvent.revive(raw);
  }

  toEntityFromForm?(form: Record<string, any>): IAppEvent {
    // use fromData which expects serialized-like object
    return TransitionPageEvent.fromData(form as Record<string, any>);
  }

  getInitial?(action?: any) {
    return { transitionUrl: action?.transitionUrl ?? "" };
  }

  validate?(data: Record<string, any>) {
    if (!data || !data.transitionUrl) {
      alert("URLを入力してください");
      return false;
    }
    return true;
  }

  getFormComponent?() {
    return null;
  }
}
