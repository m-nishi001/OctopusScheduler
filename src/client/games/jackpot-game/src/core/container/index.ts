import { container } from "tsyringe";
import { MemberRepository } from "../../model/infrastructures/repository/member-repository";
import { AssetRepository } from "../../model/infrastructures/repository/asset-repository";
import type { IMemberRepository } from "../../model/domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";

export class Container {
  static register() {
    container.register<IMemberRepository>("IMemberRepository", {
      useClass: MemberRepository,
    });
    container.register<IAssetRepository>("IAssetRepository", {
      useClass: AssetRepository,
    });
  }
}
