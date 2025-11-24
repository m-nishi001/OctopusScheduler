import type { IAppEvent } from "./app-event";

export const IAppEventConverterToken = Symbol("IAppEventConverter");

export interface IAppEventConverter {
  getType(): string;

  // Optional: convert editor/app DTO -> domain entity
  toEntity?(dto: Record<string, any>, context?: Record<string, any>): IAppEvent;

  // Optional: convert domain entity -> DTO for UI
  toDto?(entity: IAppEvent): Record<string, any>;
}
