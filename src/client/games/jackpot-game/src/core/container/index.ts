import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/member-repository";
import { AssetDataRepository } from "../../model/infrastructures/asset-data-repository";
import { PrizeRepository } from "../../model/infrastructures/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/screen-config-repository";
import { IScreenSettingRepositoryToken } from "../../model/domains/screen-config/repository/i-screen-setting-repository";
import { DrawResultRepository } from "../../model/infrastructures/draw-result-repository";
import { IAssetDataRepositoryToken } from "../../model/domains/drive-data/repository/i-asset-data-repository";
import { IMemberRepositoryToken } from "../../model/domains/member/repository/i-member-repository";
import { IPrizeRepositoryToken } from "../../model/domains/prize/repository/i-prize-repository";
import { IDrawResultRepositoryToken } from "../../model/domains/draw-result/repository/i-draw-result-repository";
import { AssetDataService } from "../../model/applications/asset/asset-data-service";
import { ScreenSettingsService } from "../../model/applications/screen-config/screen-settings-service";
import { ScreenConfigService } from "../../model/applications/screen-config/screen-config-service";
import { DrawResultService } from "../../model/applications/draw-result/draw-result-service";

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
  }
}
