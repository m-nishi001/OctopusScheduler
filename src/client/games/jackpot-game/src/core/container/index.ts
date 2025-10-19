import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/member-repository";
import { AssetDataRepository } from "../../model/infrastructures/asset-data-repository";
import { PrizeRepository } from "../../model/infrastructures/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/screen-config-repository";
import { DrawResultRepository } from "../../model/infrastructures/draw-result-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/i-member-repository";
import type { IAssetDataRepository } from "../../model/domains/drive-data/repository/i-asset-data-repository";
import type { IPrizeRepository } from "../../model/domains/prize/repository/i-prize-repository";
import type { IScreenSettingRepository } from "../../model/domains/screen-config/repository/i-screen-setting-repository";
import type { IDrawResultRepository } from "../../model/domains/draw-result/repository/i-draw-result-repository";
import { AssetDataService } from "../../model/applications/asset/asset-data-service";
import { HomeScreenConfigConverter } from "../../model/applications/screen-config/home/home-screen-config-converter";
import { OpeningScreenConfigConverter } from "../../model/applications/screen-config/opening/opening-screen-config-converter";
import { DescriptionScreenConfigConverter } from "../../model/applications/screen-config/description/description-screen-config-converter";
import { DemoScreenConfigConverter } from "../../model/applications/screen-config/demo/demo-screen-config-converter";
import { MainScreenConfigConverter } from "../../model/applications/screen-config/main/main-screen-config-converter";
import { ResultScreenConfigConverter } from "../../model/applications/screen-config/result/result-screen-config-converter";
import { EndingScreenConfigConverter } from "../../model/applications/screen-config/ending/ending-screen-config-converter";
import { IScreenConfigConverterToken } from "../../model/applications/screen-config/i-screen-config-converter";
import { ScreenConfigService } from "../../model/applications/screen-config/screen-config-service";
import { DrawResultService } from "../../model/applications/draw-result/draw-result-service";

export class Container {
  static register() {
    container.register<IMemberRepository>(
      "IMemberRepository",
      MemberRepository
    );
    container.register<IAssetDataRepository>(
      "IAssetDataRepository",
      AssetDataRepository
    );
    container.register<IPrizeRepository>("IPrizeRepository", PrizeRepository);
    container.register<IScreenSettingRepository>(
      "IScreenSettingRepository",
      ScreenConfigRepository
    );
    container.register<IDrawResultRepository>(
      "IDrawResultRepository",
      DrawResultRepository
    );
    container.register<AssetDataService>("AssetDataService", AssetDataService);
    container.register(IScreenConfigConverterToken, {
      useClass: HomeScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: OpeningScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: DescriptionScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: DemoScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: MainScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: ResultScreenConfigConverter,
    });
    container.register(IScreenConfigConverterToken, {
      useClass: EndingScreenConfigConverter,
    });
    container.register("IScreenSettingRepository", {
      useClass: ScreenConfigRepository,
    });
    container.register(ScreenConfigService, {
      useClass: ScreenConfigService,
    });
    container.register(DrawResultService, {
      useClass: DrawResultService,
    });
  }
}
