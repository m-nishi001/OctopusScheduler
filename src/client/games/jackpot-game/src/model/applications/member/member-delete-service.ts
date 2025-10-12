import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import { AssetService } from "../asset/asset-service";

@injectable()
export class MemberDeleteService {
  constructor(
    @inject("IMemberRepository") private repo: IMemberRepository,
    @inject(AssetService) private assetService: AssetService
  ) {}

  async deleteMember(id: string): Promise<void> {
    const member = await this.repo.getMemberById(id);
    await this.repo.deleteMembers([id]);
    if (member?.photoAssetId) {
      await this.assetService.unregisterRef(member.photoAssetId, member.id);
    }
  }

  async deleteMembers(ids: string[]): Promise<void> {
    const members = await Promise.all(
      ids.map((id) => this.repo.getMemberById(id))
    );
    await this.repo.deleteMembers(ids);
    for (const member of members) {
      if (member?.photoAssetId) {
        await this.assetService.unregisterRef(member.photoAssetId, member.id);
      }
    }
  }
}
