import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/i-asset-repository";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { toMember } from "./dto/member-dto";
import type { Asset } from "../../domains/asset/asset";
import type { Member } from "../../domains/member/member";
import { FileUtils } from "../../infrastructures/utils/file-utils";

@injectable()
export class MemberAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IMemberRepository") private memberRepo: IMemberRepository
  ) {}

  async createTempAsset(file: File): Promise<Asset> {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    return {
      id: "",
      name: file.name,
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size,
      referenceFrom: [],
    };
  }

  async saveMember(member: MemberDto, tempAsset?: Asset): Promise<Member> {
    let assetId: string | undefined;
    if (tempAsset) {
      const assets = await this.assetRepo.addAssets([tempAsset]);
      assetId = assets[0];
    }
    const memberToSave = {
      ...member,
      photoAssetId: assetId || member.photoAssetId,
    };
    const addedMembers = await this.memberRepo.addMembers([
      toMember(memberToSave),
    ]);
    const addedMember = addedMembers[0];
    if (tempAsset) {
      addedMember.photoDataUrl = tempAsset.dataUrl;
    }
    return addedMember;
  }
}
