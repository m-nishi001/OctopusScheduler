import { container } from "tsyringe";

import { AssetService } from "../applications/asset/asset-service";
import { GasService } from "../applications/draw/gas-service";
import { ScreenConfigService } from "../applications/screen-config/screen-config-service";

import { DrawResultService } from "../applications/draw-result/draw-result-service";
import { MemberService } from "../applications/member/member-service";
import { PrizeService } from "../applications/prize/prize-service";

import { IMemberRepository } from "../domain/member/member-repository";
import { IPrizeRepository } from "../domain/prize/prize-repository";
import { IDrawResultRepository } from "../domain/draw/draw-result-repository";
import { IAssetRepository } from "../domain/asset/asset-repository";
import { IScreenConfigRepository } from "../domain/screen-config/screen-config-repository";

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

    container.register<AssetService>("IAssetService", {
      useClass: AssetService,
    });
    container.register("IAssetRepository", { useClass: AssetRepository });

    container.register<GasService>("IGasService", {
      useClass: ScreenConfigService,
    });
    container.register<GasService>("IGasService", {
      useClass: AssetService,
    });
    container.register<GasService>("IGasService", {
      useClass: DrawResultService,
    });
    container.register<GasService>("IGasService", { useClass: MemberService });
    container.register<GasService>("IGasService", { useClass: PrizeService });

    container.register<DrawResultService>("DrawResultService", {
      useClass: DrawResultService,
    });
  }
}
