import { injectable, inject } from "tsyringe";
import type { PrizeDto } from "../prize/dto/prize-dto";
import type { ScreenConfigDto } from "../screen-config/dto/screen-config-dto";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";

@injectable()
export class AssetUsageService {
  constructor(
    @inject("IMemberRepository") private memberRepo: IMemberRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository,
    @inject("IScreenConfigRepository")
    private screenConfigRepo: IScreenConfigRepository
  ) {}

  async getUsagesForAssets(
    assetIds: string[]
  ): Promise<Record<string, string[]>> {
    const [members, prizes] = await Promise.all([
      this.memberRepo.getMembers(),
      this.prizeRepo.getPrizes(),
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
      screenTypes.map((t) => this.screenConfigRepo.getScreenConfigById(t))
    );

    const map: Record<string, string[]> = {};
    for (const id of assetIds) map[id] = [];

    // Members
    members.forEach((member) => {
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
