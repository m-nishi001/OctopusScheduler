import type { IAppEvent } from "../../domains/app-event/app-event";
import type { IAppEventDto } from "./i-app-event-dto";

export const IAppEventConverterToken = Symbol("IAppEventConverter");

export interface IAppEventConverter {
  // Identifier for the event type handled by this converter
  getType?(): string;
  // Convert DTO (used by UI/app) -> domain entity
  toEntity(dto: IAppEventDto): IAppEvent;

  // Convert domain entity -> DTO (used by UI, persistence, etc.)
  toDto(entity: IAppEvent): IAppEventDto;

  // NOTE: revival (persisted -> domain) is handled by dedicated serializers.
  // Application converters are responsible only for DTO ⇄ Entity conversion.

  // Optional: provide form component for editor UI
  getFormComponent?(): any | null;
}
