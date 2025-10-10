import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/repositories/member-repository";
import { AssetRepository } from "../../model/infrastructures/repositories/asset-repository";
import { PrizeRepository } from "../../model/infrastructures/repositories/prize-repository";
import { ScreenConfigRepository } from "../../model/infrastructures/repositories/screen-config-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { IPrizeRepository } from "../../model/domains/prize/repository/IPrizeRepository";
import type { IScreenConfigRepository } from "../../model/domains/screen-config/repository/IScreenConfigRepository";
import { AssetService } from "../../model/applications/asset/asset-service";
import { AssetUsageService } from "../../model/applications/asset/asset-usage-service";

export class Container {
  static register() {
    container.register<IMemberRepository>(
      "IMemberRepository",
      MemberRepository
    );
    container.register<IAssetRepository>("IAssetRepository", AssetRepository);
    container.register<IPrizeRepository>("IPrizeRepository", PrizeRepository);
    container.register<IScreenConfigRepository>(
      "IScreenConfigRepository",
      ScreenConfigRepository
    );
    container.register<AssetService>("AssetService", AssetService);
    container.register<AssetUsageService>(
      "AssetUsageService",
      AssetUsageService
    );
  }
}
