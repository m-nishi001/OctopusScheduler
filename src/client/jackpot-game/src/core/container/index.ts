import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/member-repository";
import { AssetDataRepository } from "../../model/infrastructures/asset-data-repository";
import { PrizeRepository } from "../../model/infrastructures/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/screen-config-repository";
import { IScreenSettingRepositoryToken } from "../../model/domains/screen-config/repository/i-screen-setting-repository";
import { DrawResultRepository } from "../../model/infrastructures/draw/draw-result-repository";
import { IAssetDataRepositoryToken } from "../../model/domains/drive-data/repository/i-asset-data-repository";
import { IMemberRepositoryToken } from "../../model/domains/member/repository/i-member-repository";
import { IPrizeRepositoryToken } from "../../model/domains/prize/repository/i-prize-repository";
import { IDrawResultRepositoryToken } from "../../model/domains/draw/repository/i-draw-result-repository";
import { AssetDataService } from "../../model/applications/asset/asset-data-service";
import { ScreenSettingsService } from "../../model/applications/screen-config/screen-settings-service";
import { ScreenConfigService } from "../../model/applications/screen-config/screen-config-service";
import { DrawResultService } from "../../model/applications/draw/draw-result-service";
import { PrizeDrawStateRepository } from "../../model/infrastructures/draw/prize-draw-state-repository";
import { MemberDrawService } from "../../model/domains/draw/member-draw-service";
import { PrizeDrawService } from "../../model/domains/draw/prize-draw-service";
import { WeightedSelector } from "../../model/domains/draw/weighted-selector";
import { DrawApplicationService } from "../../model/applications/draw/draw-application-service";
import { DrawStateInitializer } from "../../model/applications/draw/draw-state-initializer";
import { RandomProviderToken } from "../../model/domains/common/random-provider";
import { MathRandomProvider } from "../../model/infrastructures/random/math-random-provider";
import { IdGeneratorToken } from "../../model/domains/common/id-generator";
import { CryptoIdGenerator } from "../../model/infrastructures/id/crypto-id-generator";

export class Container {
  static register() {
    container.register(IMemberRepositoryToken, { useClass: MemberRepository });
    container.register(IAssetDataRepositoryToken, {
      useClass: AssetDataRepository,
    });
    container.register(IPrizeRepositoryToken, { useClass: PrizeRepository });
    container.register(IScreenSettingRepositoryToken, {
      useClass: ScreenConfigRepository,
    });
    container.register(IDrawResultRepositoryToken, {
      useClass: DrawResultRepository,
    });
    container.register(AssetDataService, { useClass: AssetDataService });
    container.register(ScreenSettingsService, {
      useClass: ScreenSettingsService,
    });
    container.register(IScreenSettingRepositoryToken, {
      useClass: ScreenConfigRepository,
    });
    container.register(ScreenConfigService, { useClass: ScreenConfigService });
    container.register(DrawResultService, { useClass: DrawResultService });
    container.register(PrizeDrawStateRepository, {
      useClass: PrizeDrawStateRepository,
    });
    container.register(MemberDrawService, { useClass: MemberDrawService });
    container.register(PrizeDrawService, { useClass: PrizeDrawService });
    container.register(WeightedSelector, { useClass: WeightedSelector });
    container.register(DrawStateInitializer, {
      useClass: DrawStateInitializer,
    });
    container.register(DrawApplicationService, {
      useClass: DrawApplicationService,
    });
    container.register(RandomProviderToken, { useClass: MathRandomProvider });
    container.register(IdGeneratorToken, { useClass: CryptoIdGenerator });
  }
}
