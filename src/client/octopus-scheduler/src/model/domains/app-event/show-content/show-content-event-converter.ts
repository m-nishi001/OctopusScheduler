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

  toEntity?(dto: Record<string, any>): IAppEvent {
    return ShowContentEvent.fromData(dto as Record<string, any>);
  }

  toDto?(entity: IAppEvent): Record<string, any> {
    // @ts-ignore
    const obj = (entity as any).serializeAsObject
      ? (entity as any).serializeAsObject()
      : {};
    return { actionType: (entity as any).type, ...obj };
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
