import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../../../domains/app-event/i-app-event-converter";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { SlideshowEvent } from "../../../domains/app-event/slideshow/slideshow-event";
import type { IAppEventDto } from "../i-app-event-dto";

@injectable()
export class SlideshowEventConverter implements IAppEventConverter {
  toEntity(dto: IAppEventDto): IAppEvent {
    return SlideshowEvent.fromData(dto as Record<string, any>);
  }

  toDto(entity: IAppEvent): IAppEventDto {
    return {
      actionType: this.getType(),
      ...(entity as any),
    } as IAppEventDto;
  }

  getType(): string {
    return "SlideshowEvent";
  }

  getFormComponent?() {
    return null;
  }
}
