import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../i-app-event-converter";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { TransitionPageEvent } from "../../../domains/app-event/transition/transition-page-event";
import type { IAppEventDto } from "../i-app-event-dto";

@injectable()
export class TransitionPageEventConverter implements IAppEventConverter {
  toEntity(dto: IAppEventDto): IAppEvent {
    return TransitionPageEvent.fromData(dto as Record<string, any>);
  }

  toDto(entity: IAppEvent): IAppEventDto {
    return {
      actionType: this.getType(),
      ...(entity as any),
    } as IAppEventDto;
  }

  getType(): string {
    return "TransitionPageEvent";
  }

  getFormComponent?() {
    return null;
  }
}
