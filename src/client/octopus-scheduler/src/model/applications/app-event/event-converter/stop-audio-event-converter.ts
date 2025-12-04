import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../../../domains/app-event/i-app-event-converter";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { StopAudioEvent } from "../../../domains/app-event/stop-audio/stop-audio-event";
import type { IAppEventDto } from "../i-app-event-dto";

@injectable()
export class StopAudioEventConverter implements IAppEventConverter {
  toEntity(dto: IAppEventDto): IAppEvent {
    return StopAudioEvent.fromData(dto as Record<string, any>);
  }

  toDto(entity: IAppEvent): IAppEventDto {
    return {
      actionType: this.getType(),
      ...(entity as any),
    } as IAppEventDto;
  }

  getType(): string {
    return "StopAudioEvent";
  }

  getFormComponent?() {
    return null;
  }
}
