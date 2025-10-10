import { injectable, inject } from "tsyringe";
import type { MemberDto } from "../member/dto/member-dto";
import type { PrizeDto } from "../prize/dto/prize-dto";
import type { ScreenConfigDto } from "../screen-config/dto/screen-config-dto";
import { MemberService } from "../member/member-service";
import { PrizeService } from "../prize/prize-service";
import { ScreenConfigService } from "../screen-config/screen-config-service";

@injectable()
export class AssetUsageService {
  constructor(
    @inject(MemberService) private memberService: MemberService,
    @inject(PrizeService) private prizeService: PrizeService,
    @inject(ScreenConfigService)
    private screenConfigService: ScreenConfigService
  ) {}

  async getUsagesForAssets(
    assetIds: string[]
  ): Promise<Record<string, string[]>> {
    const [members, prizes] = await Promise.all([
      this.memberService.fetchMembers(),
      this.prizeService.fetchPrizes(),
    ]);
    const screenTypes = [
      "home",
      "opening",
      "description",
      "demo",
      "main",
      "result",
      "admin",
    ];
    const screenConfigs = await Promise.all(
      screenTypes.map((t) => this.screenConfigService.fetchScreenConfig(t))
    );

    const map: Record<string, string[]> = {};
    for (const id of assetIds) map[id] = [];

    // Members
    members.forEach((member: MemberDto) => {
      if (member.photoAssetId && map[member.photoAssetId]) {
        map[member.photoAssetId].push(`メンバー: ${member.name}`);
      }
    });
    // Prizes
    (prizes as PrizeDto[]).forEach((prize) => {
      if (!prize) return;
      if (prize.imageAssetId && map[prize.imageAssetId]) {
        map[prize.imageAssetId].push(`景品: ${prize.name} (画像)`);
      }
      if (prize.bgm1AssetId && map[prize.bgm1AssetId]) {
        map[prize.bgm1AssetId].push(`景品: ${prize.name} (BGM1)`);
      }
      if (prize.bgm2AssetId && map[prize.bgm2AssetId]) {
        map[prize.bgm2AssetId].push(`景品: ${prize.name} (BGM2)`);
      }
    });
    // ScreenConfigs
    (screenConfigs as ScreenConfigDto[]).forEach((config) => {
      if (!config) return;
      if (config.bgmAssetId && map[config.bgmAssetId]) {
        map[config.bgmAssetId].push(`画面設定: ${config.type} (BGM)`);
      }
      if (config.seAssetIds && Array.isArray(config.seAssetIds)) {
        config.seAssetIds.forEach((aid) => {
          if (map[aid]) map[aid].push(`画面設定: ${config.type} (SE)`);
        });
      }
      if (Array.isArray(config.elements)) {
        config.elements.forEach((element: any) => {
          if (element.assetId && map[element.assetId]) {
            map[element.assetId].push(
              `画面設定: ${config.type} (要素: ${element.type})`
            );
          }
        });
      }
    });

    return map;
  }
}
