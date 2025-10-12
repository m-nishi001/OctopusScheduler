import { HomeScreenConfigConverter } from "./home/home-screen-config-converter";
import { OpeningScreenConfigConverter } from "./opening/opening-screen-config-converter";
import { DescriptionScreenConfigConverter } from "./description/description-screen-config-converter";
import { DemoScreenConfigConverter } from "./demo/demo-screen-config-converter";
import { MainScreenConfigConverter } from "./main/main-screen-config-converter";
import { ResultScreenConfigConverter } from "./result/result-screen-config-converter";
import { EndingScreenConfigConverter } from "./ending/ending-screen-config-converter";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenConfig } from "../../domains/screen-config/i-screen-config";

export interface IScreenConfigConverterVisitor {
  visitHome(converter: HomeScreenConfigConverter): IScreenConfig;
  visitOpening(converter: OpeningScreenConfigConverter): IScreenConfig;
  visitDescription(converter: DescriptionScreenConfigConverter): IScreenConfig;
  visitDemo(converter: DemoScreenConfigConverter): IScreenConfig;
  visitMain(converter: MainScreenConfigConverter): IScreenConfig;
  visitResult(converter: ResultScreenConfigConverter): IScreenConfig;
  visitEnding(converter: EndingScreenConfigConverter): IScreenConfig;
}

export class ScreenConfigConverterManager {
  private converters: Record<string, any> = {
    home: new HomeScreenConfigConverter(),
    opening: new OpeningScreenConfigConverter(),
    description: new DescriptionScreenConfigConverter(),
    demo: new DemoScreenConfigConverter(),
    main: new MainScreenConfigConverter(),
    result: new ResultScreenConfigConverter(),
    ending: new EndingScreenConfigConverter(),
  };

  getConverter(type: string): any {
    return this.converters[type];
  }

  convertToDto(type: string, settings: ScreenSetting[]): IScreenConfig | null {
    const converter = this.getConverter(type);
    if (converter) {
      return converter.toDto(settings);
    }
    return null;
  }

  convertToSettings(dto: IScreenConfig): ScreenSetting[] {
    const converter = this.getConverter(dto.type);
    if (converter) {
      return converter.toSettings(dto);
    }
    return [];
  }
}
