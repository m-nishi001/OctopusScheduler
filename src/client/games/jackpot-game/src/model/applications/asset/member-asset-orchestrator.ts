import { injectable, inject } from "tsyringe";
import type { MemberDto } from "../member/dto/member-dto";
import { AssetDto } from "./dto/asset-dto";
import { AssetService } from "./asset-service";
import { MemberService } from "../member/member-service";

interface MemberDtoWithAsset extends MemberDto {
  photoAsset?: File;
  photoAssetUrl?: string;
}

@injectable()
export class MemberAssetOrchestrator {
  constructor(
    @inject(AssetService) private assetService: AssetService,
    @inject(MemberService) private memberService: MemberService
  ) {}

  async batchOperations(operations: {
    add: MemberDtoWithAsset[];
    update: MemberDtoWithAsset[];
    delete: string[];
  }): Promise<void> {
    // アセット保存を事前に行い、MemberDto に photoAssetId をセット
    for (const member of operations.add) {
      if (member.photoAsset && typeof member.photoAsset !== "string") {
        const file = member.photoAsset;
        const assetDto = new AssetDto(file);
        await assetDto.setDataUrl();
        await this.assetService.addAsset(assetDto);
        member.photoAssetId = assetDto.id;
        member.photoAssetUrl = assetDto.dataUrl;
      }
    }
    for (const member of operations.update) {
      if (member.photoAsset && typeof member.photoAsset !== "string") {
        const file = member.photoAsset;
        const assetDto = new AssetDto(file);
        await assetDto.setDataUrl();
        await this.assetService.updateAsset(assetDto);
        member.photoAssetId = assetDto.id;
        member.photoAssetUrl = assetDto.dataUrl;
      }
    }

    // アセット保存後の MemberDto を MemberService に渡す
    const cleanedOperations = {
      add: operations.add.map(({ photoAsset, photoAssetUrl, ...m }) => m),
      update: operations.update.map(({ photoAsset, photoAssetUrl, ...m }) => m),
      delete: operations.delete,
    };

    await this.memberService.batchOperations(cleanedOperations);
  }
}
