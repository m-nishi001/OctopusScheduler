import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/i-asset-repository";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { toMember } from "./dto/member-dto";
import type { AssetDto } from "../asset/dto/asset-dto";
import type { Member } from "../../domains/member/member";

@injectable()
export class MemberAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IMemberRepository") private memberRepo: IMemberRepository
  ) {}

  async saveMember(
    member: MemberDto,
    tempAssetDto?: AssetDto
  ): Promise<Member> {
    let assetId: string | undefined;
    if (tempAssetDto) {
      const assets = await this.assetRepo.addAssets([
        await tempAssetDto.toAsset(),
      ]);
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
    if (tempAssetDto) {
      addedMember.photoDataUrl = tempAssetDto.dataUrl;
    }
    return addedMember;
  }
}
