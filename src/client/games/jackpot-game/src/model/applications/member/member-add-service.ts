import { injectable, inject } from "tsyringe";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { toMember } from "./dto/member-dto";
import type { AssetDataDto } from "../asset/dto/asset-data-dto";
import type { Member } from "../../domains/member/member";

@injectable()
export class MemberAddService {
  constructor(
    @inject("IDriveDataRepository") private driveDataRepo: IDriveDataRepository,
    @inject("IMemberRepository") private memberRepo: IMemberRepository
  ) {}

  async saveMember(
    member: MemberDto,
    tempDriveDataDto?: AssetDataDto
  ): Promise<Member> {
    let assetId: string | undefined;
    if (tempDriveDataDto) {
      const driveData = await this.driveDataRepo.addDriveData([
        await tempDriveDataDto.toDriveData(),
      ]);
      assetId = driveData[0];
    }
    const memberToSave = {
      ...member,
      photoAssetId: assetId || member.photoAssetId,
    };
    const addedMembers = await this.memberRepo.addMembers([
      toMember(memberToSave),
    ]);
    const addedMember = addedMembers[0];
    if (tempDriveDataDto) {
      try {
        addedMember.photoDataUrl = tempDriveDataDto.blob
          ? URL.createObjectURL(tempDriveDataDto.blob)
          : "";
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to create object URL for member photo blob", e);
        addedMember.photoDataUrl = "";
      }
    }
    return addedMember;
  }
}
