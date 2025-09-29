import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/repository/member-repository";
import { AssetRepository } from "../../model/infrastructures/repository/asset-repository";
import { PrizeRepository } from "../../model/infrastructures/repository/prize-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { IPrizeRepository } from "../../model/domains/prize/repository/IPrizeRepository";

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
  }
}
