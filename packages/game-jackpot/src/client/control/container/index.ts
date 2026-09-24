import { container, instanceCachingFactory } from "tsyringe";
import { IApiClientToken, createTypedApiClient } from "@octopus/infrastructures/interfaces";
import { GasApiClient } from "@octopus/infrastructures/gas/gas-api-client";
import {
  JACKPOT_GAME_PREFIX,
  JACKPOT_GAME_ENDPOINTS,
  IJackpotGameApiToken,
} from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import { MemberRepository } from "../../model/member/member-repository";
import { AssetDataRepository } from "../../model/asset/asset-data-repository";
import { PrizeRepository } from "../../model/prize/prize-repository";
import { ScreenConfigRepository } from "../../model/screen-config/screen-config-repository";
import { DrawResultRepository } from "../../model/draw/draw-result-repository";
import { AssetDataService } from "../asset/asset-data-service";
import { ScreenSettingsService } from "../screen-config/screen-settings-service";
import { ScreenConfigService } from "../screen-config/screen-config-service";
import { DrawResultService } from "../draw/draw-result-service";
import { PrizeDrawStateRepository } from "../../model/draw/prize-draw-state-repository";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import { DrawApplicationService } from "../draw/draw-application-service";
import { DrawStateInitializer } from "../draw/draw-state-initializer";
import { MathRandomProvider } from "../../model/common/math-random-provider";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";
import { RemoteControlRepository } from "../../model/remote-control/remote-control-repository";

export class Container {
  static register() {
    // GAS 用のインフラを登録する。将来 Cloudflare 等に切り替える場合は
    // ここを設定に応じて別実装に差し替えるだけでよい。
    container.register(IApiClientToken, { useClass: GasApiClient });
    container.register<JackpotGameApi>(IJackpotGameApiToken, {
      useFactory: instanceCachingFactory((c) =>
        createTypedApiClient<JackpotGameApi>(
          c.resolve(IApiClientToken),
          JACKPOT_GAME_PREFIX,
          JACKPOT_GAME_ENDPOINTS
        )
      ),
    });

    container.register(MemberRepository, { useClass: MemberRepository });
    container.register(AssetDataRepository, {
      useClass: AssetDataRepository,
    });
    container.register(PrizeRepository, { useClass: PrizeRepository });
    container.register(ScreenConfigRepository, {
      useClass: ScreenConfigRepository,
    });
    container.register(DrawResultRepository, {
      useClass: DrawResultRepository,
    });
    container.register(AssetDataService, { useClass: AssetDataService });
    container.register(ScreenSettingsService, {
      useClass: ScreenSettingsService,
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
    container.register(MathRandomProvider, { useClass: MathRandomProvider });
    container.register(CryptoIdGenerator, { useClass: CryptoIdGenerator });
    container.register(RemoteControlRepository, {
      useClass: RemoteControlRepository,
    });
  }
}
