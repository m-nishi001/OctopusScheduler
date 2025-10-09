import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import type { MemberDto } from "./dto/member-dto";

@injectable()
export class MemberService {
  constructor(
    @inject("IMemberRepository") private repo: IMemberRepository,
    @inject("IAssetRepository") private assetRepo: IAssetRepository
  ) {}

  async fetchMembers(): Promise<MemberDto[]> {
    const members = await this.repo.fetchMembers();
    if (!Array.isArray(members) || !members) return [];
    const resolvedMembers = await Promise.all(
      members.map(async (m) => {
        if (m.photoAssetId) {
          const asset = await this.assetRepo.getAssetById(m.photoAssetId);
          return { ...m, photoUrl: asset?.dataUrl };
        }
        return m;
      })
    );
    return resolvedMembers;
  }

  async batchOperations(operations: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): Promise<void> {
    await this.repo.batchOperations(operations);
  }
}
