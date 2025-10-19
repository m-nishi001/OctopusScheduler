import { injectable, inject } from "tsyringe";
import { AssetDataService } from "../asset/asset-data-service";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { toMember } from "./dto/member-dto";
import type { AssetDataDto } from "../asset/dto/asset-data-dto";
import type { Member } from "../../domains/member/member";

@injectable()
export class MemberAddService {
  constructor(
    @inject("DriveDataService") private driveDataService: AssetDataService,
    @inject("IMemberRepository") private memberRepo: IMemberRepository
  ) {}

  async saveMember(
    member: MemberDto,
    tempDriveDataDto?: AssetDataDto
  ): Promise<Member> {
    let assetId: string | undefined;
    if (tempDriveDataDto) {
      const updated = await this.driveDataService.addDriveData([
        tempDriveDataDto,
      ]);
      assetId = updated[0].id || undefined;
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
