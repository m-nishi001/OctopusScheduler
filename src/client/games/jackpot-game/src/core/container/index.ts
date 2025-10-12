import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/repositories/member-repository";
import { AssetRepository } from "../../model/infrastructures/repositories/asset-repository";
import { PrizeRepository } from "../../model/infrastructures/repositories/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/repositories/screen-config-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/i-member-repository";
import type { IAssetRepository } from "../../model/domains/asset/repository/i-asset-repository";
import type { IPrizeRepository } from "../../model/domains/prize/repository/i-prize-repository";
import type { IScreenSettingRepository } from "../../model/domains/screen-config/repository/i-screen-setting-repository";
import { AssetService } from "../../model/applications/asset/asset-service";
import { HomeScreenConfigConverter } from "../../model/applications/screen-config/home/home-screen-config-converter";
import { OpeningScreenConfigConverter } from "../../model/applications/screen-config/opening/opening-screen-config-converter";
import { DescriptionScreenConfigConverter } from "../../model/applications/screen-config/description/description-screen-config-converter";
import { DemoScreenConfigConverter } from "../../model/applications/screen-config/demo/demo-screen-config-converter";
import { MainScreenConfigConverter } from "../../model/applications/screen-config/main/main-screen-config-converter";
import { ResultScreenConfigConverter } from "../../model/applications/screen-config/result/result-screen-config-converter";
import { EndingScreenConfigConverter } from "../../model/applications/screen-config/ending/ending-screen-config-converter";
import { IScreenConfigConverterToken } from "../../model/applications/screen-config/i-screen-config-converter";
import { ScreenConfigService } from "../../model/applications/screen-config/screen-config-service";

export class Container {
  static register() {
    container.register<IMemberRepository>(
      "IMemberRepository",
      MemberRepository
    );
    container.register<IAssetRepository>("IAssetRepository", AssetRepository);
    container.register<IPrizeRepository>("IPrizeRepository", PrizeRepository);
    container.register<IScreenSettingRepository>(
      "IScreenSettingRepository",
      ScreenConfigRepository
    );
    container.register<AssetService>("AssetService", AssetService);
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
  }
}
