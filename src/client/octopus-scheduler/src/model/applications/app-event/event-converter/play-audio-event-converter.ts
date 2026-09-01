import { injectable } from "tsyringe";
import type { IAppEventConverter } from "../../../domains/app-event/i-app-event-converter";
import type { IAppEvent } from "../../../domains/app-event/app-event";
import { PlayAudioEvent } from "../../../domains/app-event/play-audio/play-audio-event";
import type { IAppEventDto } from "../i-app-event-dto";

@injectable()
export class PlayAudioEventConverter implements IAppEventConverter {
  // Application-facing conversion
  toEntity(dto: IAppEventDto): IAppEvent {
    // dto may contain audioId and other fields
    return PlayAudioEvent.fromData(dto as Record<string, any>);
  }

  toDto(entity: IAppEvent): IAppEventDto {
    // map domain to DTO
    return {
      actionType: this.getType(),
      ...(entity as any),
    } as IAppEventDto;
  }

  // Compatibility methods used by repository/service revive paths
  getType(): string {
    return "PlayAudioEvent";
  }

  // legacy form helpers (kept for compatibility; prefer AppEventService.getDefault)
  getFormComponent?() {
    return null;
  }
}
