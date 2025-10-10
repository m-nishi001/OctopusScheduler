import { container } from "tsyringe";

import { AssetApiService } from "../application/services/asset-api-service";
import { GasService } from "../application/services/gas-service";
import { LotteryCoordinator } from "../application/services/lottery-coordinator";
import { DrawPairingService } from "../application/services/draw-pairing-service";
import { UniformDrawStrategy } from "../domain/draw-strategies/uniform-draw-strategy";
import { DrawStrategy } from "../domain/draw-strategies/draw-strategy";
import { Member } from "../domain/entities/member";
import { Prize } from "../domain/entities/prize";
import { ScreenConfigService } from "../application/services/screen-config-service";

import { DrawResultService } from "../application/services/draw-result-service";
import { MemberService } from "../application/services/member-service";
import { PrizeService } from "../application/services/prize-service";

import { IMemberRepository } from "../domain/repositories/member-repository";
import { IPrizeRepository } from "../domain/repositories/prize-repository";
import { IDrawResultRepository } from "../domain/repositories/draw-result-repository";
import { IAssetRepository } from "../domain/repositories/asset-repository";
import { IScreenConfigRepository } from "../domain/repositories/screen-config-repository";

import { MemberRepository } from "../infrastructure/repositories/member-repository";
import { PrizeRepository } from "../infrastructure/repositories/prize-repository";
import { DrawResultRepository } from "../infrastructure/repositories/draw-result-repository";
import { AssetRepository } from "../infrastructure/repositories/asset-repository";
import { ScreenConfigRepository } from "../infrastructure/repositories/screen-config-repository";

export class Container {
  static register() {
    container.register<IMemberRepository>("IMemberRepository", {
      useClass: MemberRepository,
    });
    container.register<IPrizeRepository>("IPrizeRepository", {
      useClass: PrizeRepository,
    });
    container.register<IDrawResultRepository>("IDrawResultRepository", {
      useClass: DrawResultRepository,
    });
    container.register<IAssetRepository>("IAssetRepository", {
      useClass: AssetRepository,
    });
    container.register<IScreenConfigRepository>("IScreenConfigRepository", {
      useClass: ScreenConfigRepository,
    });

    container.register<AssetApiService>("IAssetService", {
      useClass: AssetApiService,
    });
    container.register("IAssetRepository", { useClass: AssetRepository });

    container.register<GasService>("IGasService", {
      useClass: ScreenConfigService,
    });
    container.register<GasService>("IGasService", {
      useClass: LotteryCoordinator,
    });
    container.register<GasService>("IGasService", {
      useClass: AssetApiService,
    });
    container.register<GasService>("IGasService", {
      useClass: DrawResultService,
    });
    container.register<GasService>("IGasService", { useClass: MemberService });
    container.register<GasService>("IGasService", { useClass: PrizeService });

    container.register<DrawResultService>("DrawResultService", {
      useClass: DrawResultService,
    });

    container.register<DrawStrategy<Member>>("MemberDrawStrategy", {
      useClass: UniformDrawStrategy,
    });
    container.register<DrawStrategy<Prize>>("PrizeDrawStrategy", {
      useClass: UniformDrawStrategy,
    });
    container.register<DrawPairingService>("DrawPairingService", {
      useClass: DrawPairingService,
    });
  }
}
