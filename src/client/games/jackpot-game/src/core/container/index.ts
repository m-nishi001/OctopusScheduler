import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/repository/member-repository";
import { AssetRepository } from "../../model/infrastructures/repository/asset-repository";
import { PrizeRepository } from "../../model/infrastructures/repository/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/repository/screen-config-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { IPrizeRepository } from "../../model/domains/prize/repository/IPrizeRepository";
import type { IScreenConfigRepository } from "../../model/domains/screen-config/repository/IScreenConfigRepository";
import { DrawOrchestrator } from "../../model/applications/draw/draw-orchestrator";
import { DrawService } from "../../model/applications/draw/draw-service";
import { ResultService } from "../../model/applications/result/result-service";
import { PrizeService } from "../../model/applications/prize/prize-service";
import { MemberService } from "../../model/applications/member/member-service";
import { MemberBatchService } from "../../model/applications/member/member-batch-service";

export class Container {
  static register() {
    container.register<IMemberRepository>("IMemberRepository", {
      useClass: MemberRepository,
    });
    container.register<IAssetRepository>("IAssetRepository", {
      useClass: AssetRepository,
    });
    container.register<IPrizeRepository>("IPrizeRepository", {
      useClass: PrizeRepository,
    });
    container.register<IScreenConfigRepository>("IScreenConfigRepository", {
      useClass: ScreenConfigRepository,
    });
    container.register<DrawOrchestrator>("DrawOrchestrator", {
      useClass: DrawOrchestrator,
    });
    container.register("DrawService", { useClass: DrawService } as any);
    container.register("ResultService", { useClass: ResultService } as any);
    container.register("PrizeService", { useClass: PrizeService } as any);
    container.register("MemberService", { useClass: MemberService } as any);
    container.register("MemberBatchService", {
      useClass: MemberBatchService,
    } as any);
  }
}
