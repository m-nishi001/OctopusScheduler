import { container, instanceCachingFactory } from "tsyringe";
import {
  IApiClientToken,
  IConcurrencyPolicyToken,
  createTypedApiClient,
} from "@octopus/infrastructures/interfaces";
import { PlatformApiClient } from "@octopus/infrastructures/platform-api-client";
import { PlatformConcurrencyPolicy } from "@octopus/infrastructures/platform-concurrency-policy";
import { SyncRunner } from "@octopus/sync-engine";
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
import { AssetDataService } from "../asset/asset-data-service";
import { ScreenSettingsService } from "../screen-config/screen-settings-service";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import { DrawStoreProvider } from "../draw/draw-store-provider";
import { DrawApplicationService } from "../draw/draw-application-service";
import { DrawStateInitializer } from "../draw/draw-state-initializer";
import { MathRandomProvider } from "../../model/common/math-random-provider";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";
import { SyncService } from "../sync/sync-service";
import { AllMembersDrawPool, DrawPoolProviderToken } from "../../model/draw/draw-pool";

/** ジャックポットの依存の登録。ビルド対象(GAS / Cloudflare)ごとの API クライアントなど、環境で変わるものをここで結ぶ。 */
export class Container {
  static register() {
    // ビルド対象(GAS/Cloudflare)ごとに @octopus/infrastructures/platform-api-client が
    // 解決する実装(Viteのresolve.conditions)を登録する。
    container.register(IApiClientToken, { useClass: PlatformApiClient });
    // 同期エンジンの並列度も同じ仕組みで環境ごとに切り替える。
    container.register(IConcurrencyPolicyToken, {
      useClass: PlatformConcurrencyPolicy,
    });
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
    container.register(AssetDataService, { useClass: AssetDataService });
    container.register(ScreenSettingsService, {
      useClass: ScreenSettingsService,
    });
    // 抽選状態の置き場の選択(セッションの結果ファイル / メモリだけ)。読み込んだ内容を持つのでアプリで1つ。
    container.registerSingleton(DrawStoreProvider);
    container.register(MemberDrawService, { useClass: MemberDrawService });
    container.register(PrizeDrawService, { useClass: PrizeDrawService });
    container.register(WeightedSelector, { useClass: WeightedSelector });
    container.register(DrawStateInitializer, {
      useClass: DrawStateInitializer,
    });
    // 抽選の対象。既定は全メンバー。アプリが setDrawPoolProvider で差し替える（後から登録したものが優先される）。
    container.register(DrawPoolProviderToken, { useClass: AllMembersDrawPool });
    container.register(DrawApplicationService, {
      useClass: DrawApplicationService,
    });
    container.register(MathRandomProvider, { useClass: MathRandomProvider });
    container.register(CryptoIdGenerator, { useClass: CryptoIdGenerator });
    container.register(SyncRunner, { useClass: SyncRunner });
    container.register(SyncService, { useClass: SyncService });
  }
}
