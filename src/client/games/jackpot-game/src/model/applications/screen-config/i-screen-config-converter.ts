import type { ScreenType } from "../../domains/screen-config/i-screen-config";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenConfig } from "../../domains/screen-config/i-screen-config";

export const IScreenConfigConverterToken = Symbol("IScreenConfigConverter");

export interface IScreenConfigConverter {
  getType(): ScreenType;
  toDto(settings: ScreenSetting[]): IScreenConfig;
  toSettings(dto: IScreenConfig): ScreenSetting[];
}
