import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../../../domains/app-event/i-app-event-converter";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { ShowContentEvent } from "../../../domains/app-event/show-content/show-content-event";
import type { IAppEventDto } from "../i-app-event-dto";

@injectable()
export class ShowContentEventConverter implements IAppEventConverter {
  toEntity(dto: IAppEventDto): IAppEvent {
    return ShowContentEvent.fromData(dto as Record<string, any>);
  }

  toDto(entity: IAppEvent): IAppEventDto {
    return {
      actionType: this.getType(),
      ...(entity as any),
    } as IAppEventDto;
  }

  getType(): string {
    return "ShowContentEvent";
  }

  getFormComponent?() {
    return null;
  }
}
