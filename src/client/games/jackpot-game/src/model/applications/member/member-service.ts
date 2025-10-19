import { injectable, inject } from "tsyringe";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "./dto/member-dto";
import { fromMember, toMember } from "./dto/member-dto";
import { AssetDataService } from "../asset/asset-data-service";
import type { Asset } from "../../domains/drive-data/asset-data";
import type { Member } from "../../domains/member/member";

@injectable()
export class MemberService {
  constructor(
    @inject("DriveDataService") private driveDataService: AssetDataService,
    @inject("IMemberRepository") private repo: IMemberRepository
  ) {}

  async fetchMembers(): Promise<MemberDto[]> {
    const members = await this.repo.getMembers();
    return members.map(fromMember);
  }

  async addMember(member: MemberDto): Promise<MemberDto> {
    const addedMembers = await this.repo.addMembers([toMember(member)]);
    return fromMember(addedMembers[0]);
  }

  async updateMember(id: string, member: MemberDto): Promise<void> {
    const updateOps = [{ id, updateFn: (_: any) => toMember(member) }];
    await this.repo.updateMembers(updateOps);
  }

  async saveMember(
    member: MemberDto,
    tempDriveDataDto?: Asset
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
    const addedMembers = await this.repo.addMembers([toMember(memberToSave)]);
    const addedMember = addedMembers[0];
    if (tempDriveDataDto) {
      try {
        addedMember.photoDataUrl = URL.createObjectURL(tempDriveDataDto.blob);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to create object URL for member photo blob", e);
        addedMember.photoDataUrl = "";
      }
    }
    return addedMember;
  }

  async deleteMember(id: string): Promise<void> {
    await this.repo.deleteMembers([id]);
  }

  async deleteMembers(ids: string[]): Promise<void> {
    await this.repo.deleteMembers(ids);
  }
}
