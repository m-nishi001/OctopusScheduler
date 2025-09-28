import { container } from "tsyringe";

import { AssetService } from "../application/services/asset.service";
import { GasService } from "../application/services/gas.service";
import { LotteryService } from "../application/services/lottery-service";
// import { ResultService } from "../application/services/result.service";
import { ScreenConfigService } from "../application/services/screen-config-service";

import { DrawResultService } from "../application/services/draw-result.service";
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
import { AssetRepositoryImpl } from "../infrastructure/repositories/asset-repository";
import { ScreenConfigRepositoryImpl } from "../infrastructure/repositories/screen-config-repository";

export class Container {
    static register() {
        container.register<IMemberRepository>("IMemberRepository", { useClass: MemberRepository });
        container.register<IPrizeRepository>("IPrizeRepository", { useClass: PrizeRepository });
        container.register<IDrawResultRepository>("IDrawResultRepository", { useClass: DrawResultRepository });
        container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepositoryImpl });
        container.register<IScreenConfigRepository>("IScreenConfigRepository", { useClass: ScreenConfigRepositoryImpl });

        container.register<AssetService>("IAssetService", { useClass: AssetService });
        container.register("IAssetRepository", { useClass: AssetRepositoryImpl });

        container.register<GasService>("IGasService", { useClass: ScreenConfigService });
        container.register<GasService>("IGasService", { useClass: LotteryService });
        container.register<GasService>("IGasService", { useClass: AssetService });
        container.register<GasService>("IGasService", { useClass: DrawResultService });
        container.register<GasService>("IGasService", { useClass: MemberService });
        container.register<GasService>("IGasService", { useClass: PrizeService });

        container.register<DrawResultService>(DrawResultService, { useClass: DrawResultService });
    }
}
