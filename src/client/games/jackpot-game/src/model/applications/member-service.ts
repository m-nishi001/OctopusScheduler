import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../domains/member/repository/IMemberRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
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
    // アセットIDをURLに解決
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

  async addMember(member: MemberDto): Promise<void> {
    if (
      (member as any).photoAsset &&
      typeof (member as any).photoAsset !== "string"
    ) {
      const assetDto = {
        id: member.photoAssetId || "",
        type: "image" as "image",
        dataUrl: "",
        name: member.name + "_photo",
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: (member as any).photoAsset.size || 0,
      };
      await this.assetRepo.addAsset(assetDto);
      member.photoAssetId = assetDto.id;
      (member as any).photoAssetUrl = assetDto.dataUrl;
    }
    if (typeof this.repo.addMember === "function") {
      await this.repo.addMember(member);
    } else {
      throw new Error("addMember is not implemented in IMemberRepository");
    }
  }

  async updateMember(member: MemberDto): Promise<void> {
    if (
      (member as any).photoAsset &&
      typeof (member as any).photoAsset !== "string"
    ) {
      const assetDto = {
        id: member.photoAssetId || "",
        type: "image" as "image",
        dataUrl: "",
        name: member.name + "_photo",
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: (member as any).photoAsset.size || 0,
      };
      await this.assetRepo.updateAsset(assetDto);
      member.photoAssetId = assetDto.id;
      (member as any).photoAssetUrl = assetDto.dataUrl;
    }
    await this.repo.updateMember(member);
  }

  async deleteMember(memberId: string): Promise<void> {
    await this.repo.deleteMember(memberId);
  }
}
