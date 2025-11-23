import type { IAppEvent } from "./app-event";
import type { Component } from "vue";

export const IAppEventConverterToken = Symbol("IAppEventConverter");

export interface IAppEventConverter {
  getType(): string;
  // revive from persisted IAppEvent-like object
  canRevive(raw: IAppEvent): boolean;
  revive(raw: IAppEvent): IAppEvent;

  // optional: create entity from editor/form DTO
  toEntityFromForm?(form: Record<string, any>, context?: Record<string, any>): IAppEvent;

  // optional: provide an initial DTO for editor when editing an existing action
  getInitial?(action?: any): Record<string, any>;

  // optional: validate editor DTO
  validate?(data: Record<string, any>): boolean;

  // optional: provide form component for editor UI
  getFormComponent?(): Component | null;
}
