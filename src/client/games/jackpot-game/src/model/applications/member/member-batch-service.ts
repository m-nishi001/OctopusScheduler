import { injectable, inject } from "tsyringe";
import type { MemberDto } from "./dto/member-dto";
import { AssetDto } from "../asset/dto/asset-dto";
import { AssetService } from "../asset/asset-service";
import { MemberService } from "./member-service";

interface MemberDtoWithAsset extends MemberDto {
  photoAsset?: AssetDto;
}

@injectable()
export class MemberBatchService {
  constructor(
    @inject(AssetService) private assetService: AssetService,
    @inject(MemberService) private memberService: MemberService
  ) {}

  async execute(operations: {
    add: MemberDtoWithAsset[];
    update: MemberDto[];
    delete: MemberDto[];
  }): Promise<void> {
    await Promise.all([
      this.processAddMembers(operations.add),
      this.processDeleteMembers(operations.delete),
    ]);

    const cleanedOperations = {
      add: operations.add.map(({ photoAsset, ...m }) => m),
      update: operations.update,
      delete: operations.delete.map((m) => m.id),
    };

    await this.memberService.batchOperations(cleanedOperations);
  }

  private async processAddMembers(
    members: MemberDtoWithAsset[]
  ): Promise<void> {
    const membersWithAssets = members.filter((member) => member.photoAsset);
    const assetDtos = membersWithAssets.map((member) => member.photoAsset!);
    const result = await this.assetService.addAssets(assetDtos);
    await Promise.all(
      result.successful.map(async (dto, i) => {
        const member = membersWithAssets[i];
        member.photoAssetId = dto.id;
      })
    );
  }

  private async processDeleteMembers(members: MemberDto[]): Promise<void> {
    const membersWithAssetIds = members
      .filter((member) => member.photoAssetId)
      .map((member) => member.id);
    await this.assetService.deleteAssets(membersWithAssetIds);
  }
}
