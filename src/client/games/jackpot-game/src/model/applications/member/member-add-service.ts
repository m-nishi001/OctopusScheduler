import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";
import type { MemberDto } from "./dto/member-dto";
import { toMember, fromMember } from "./dto/member-dto";
import type { Asset } from "../../domains/asset/asset";
import { FileUtils } from "../../infrastructures/utils/file-utils";

@injectable()
export class MemberAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IMemberRepository") private memberRepo: IMemberRepository
  ) {}

  async createTempAsset(file: File): Promise<Asset> {
    const tempId = `temp-${Date.now()}`;
    const dataUrl = await FileUtils.readAsDataUrl(file);
    return {
      id: tempId,
      name: file.name,
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size,
    };
  }

  async saveMember(member: MemberDto, tempAsset?: Asset): Promise<MemberDto> {
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
    return fromMember(addedMembers[0]);
  }
}
