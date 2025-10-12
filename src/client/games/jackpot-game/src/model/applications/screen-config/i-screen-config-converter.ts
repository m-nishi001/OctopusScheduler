import type { ScreenType } from "../../domains/screen-config/i-screen-setting";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenSetting } from "../../domains/screen-config/i-screen-setting";

export const IScreenConfigConverterToken = Symbol("IScreenConfigConverter");

export interface IScreenConfigConverter {
  getType(): ScreenType;
  toDto(settings: ScreenSetting[]): IScreenSetting;
  toSettings(dto: IScreenSetting): ScreenSetting[];
}
