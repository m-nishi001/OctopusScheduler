import { container } from "tsyringe";
import { IApiClientToken } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import { MemberRepository } from "../../infrastructures/member-repository";
import { AssetDataRepository } from "../../infrastructures/asset-data-repository";
import { PrizeRepository } from "../../infrastructures/prize-repository";
import { ScreenConfigRepository } from "../../infrastructures/screen-config-repository";
import { IScreenSettingRepositoryToken } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { DrawResultRepository } from "../../infrastructures/draw/draw-result-repository";
import { IAssetDataRepositoryToken } from "../../domains/drive-data/repository/i-asset-data-repository";
import { IMemberRepositoryToken } from "../../domains/member/repository/i-member-repository";
import { IPrizeRepositoryToken } from "../../domains/prize/repository/i-prize-repository";
import { IDrawResultRepositoryToken } from "../../domains/draw/repository/i-draw-result-repository";
import { AssetDataService } from "../../applications/asset/asset-data-service";
import { ScreenSettingsService } from "../../applications/screen-config/screen-settings-service";
import { ScreenConfigService } from "../../applications/screen-config/screen-config-service";
import { DrawResultService } from "../../applications/draw/draw-result-service";
import { PrizeDrawStateRepository } from "../../infrastructures/draw/prize-draw-state-repository";
import { MemberDrawService } from "../../domains/draw/member-draw-service";
import { PrizeDrawService } from "../../domains/draw/prize-draw-service";
import { WeightedSelector } from "../../domains/draw/weighted-selector";
import { DrawApplicationService } from "../../applications/draw/draw-application-service";
import { DrawStateInitializer } from "../../applications/draw/draw-state-initializer";
import { RandomProviderToken } from "../../domains/common/random-provider";
import { MathRandomProvider } from "../../infrastructures/random/math-random-provider";
import { IdGeneratorToken } from "../../domains/common/id-generator";
import { CryptoIdGenerator } from "../../infrastructures/id/crypto-id-generator";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });

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
