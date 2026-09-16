import type { IAppEvent } from "./app-event";

export const IEventSerializerToken = Symbol("IEventSerializer");

export interface IEventSerializer {
  getType?(): string;
  canRevive(raw: IAppEvent): boolean;
  revive(raw: IAppEvent): IAppEvent | null;
}
