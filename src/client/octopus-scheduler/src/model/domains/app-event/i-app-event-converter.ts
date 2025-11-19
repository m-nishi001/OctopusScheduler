import type { IAppEvent } from "./app-event";

export const IAppEventConverterToken = Symbol("IAppEventConverter");

export interface IAppEventConverter {
  getType(): string;
  canRevive(raw: IAppEvent): boolean;
  revive(raw: IAppEvent): IAppEvent;
}
