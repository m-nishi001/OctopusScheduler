import type { IAppEvent } from "./app-event";
import type { Component } from "vue";

export const IAppEventConverterToken = Symbol("IAppEventConverter");

export interface IAppEventConverter {
  getType(): string;
  // revive from persisted IAppEvent-like object
  canRevive(raw: IAppEvent): boolean;
  revive(raw: IAppEvent): IAppEvent;

  // Optional: convert editor/app DTO -> domain entity
  toEntity?(dto: Record<string, any>, context?: Record<string, any>): IAppEvent;

  // Optional: convert domain entity -> DTO for UI
  toDto?(entity: IAppEvent): Record<string, any>;

  // optional: validate editor DTO
  validate?(data: Record<string, any>): boolean;

  // optional: provide form component for editor UI
  getFormComponent?(): Component | null;
}
