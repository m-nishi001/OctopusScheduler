import { injectable, inject } from "tsyringe";
import type { PrizeDto } from "../prize/dto/prize-dto";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/i-screen-config-repository";
import { HomeScreenConfig } from "../../domains/screen-config/home-screen-config";
import { OpeningScreenConfig } from "../../domains/screen-config/opening-screen-config";
import { DescriptionScreenConfig } from "../../domains/screen-config/description-screen-config";
import { DemoScreenConfig } from "../../domains/screen-config/demo-screen-config";
import { MainScreenConfig } from "../../domains/screen-config/main-screen-config";
import { ResultScreenConfig } from "../../domains/screen-config/result-screen-config";
import { EndingScreenConfig } from "../../domains/screen-config/ending-screen-config";

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
    screenConfigs.forEach((config) => {
      if (!config) return;
      let bgmAssetId: string | undefined;
      let seAssetIds: string[] = [];
      switch (config.type) {
        case "home":
          bgmAssetId = (config as HomeScreenConfig).homeBgm;
          seAssetIds = [
            (config as HomeScreenConfig).buttonClikingSE,
            (config as HomeScreenConfig).onCompletedLoadingSE,
          ].filter(Boolean);
          break;
        case "opening":
          bgmAssetId = (config as OpeningScreenConfig).openingBgm;
          seAssetIds = [
            (config as OpeningScreenConfig).openingSe1,
            (config as OpeningScreenConfig).openingSe2,
          ].filter(Boolean);
          break;
        case "description":
          bgmAssetId = (config as DescriptionScreenConfig).descriptionBgm;
          seAssetIds = [];
          break;
        case "demo":
          bgmAssetId = (config as DemoScreenConfig).demoBgm;
          seAssetIds = [
            (config as DemoScreenConfig).demoSe1,
            (config as DemoScreenConfig).demoSe2,
          ].filter(Boolean);
          break;
        case "main":
          bgmAssetId = (config as MainScreenConfig).mainBgm;
          seAssetIds = [
            (config as MainScreenConfig).mainSe1,
            (config as MainScreenConfig).mainSe2,
          ].filter(Boolean);
          break;
        case "result":
          bgmAssetId = (config as ResultScreenConfig).resultBgm;
          seAssetIds = [
            (config as ResultScreenConfig).resultSe1,
            (config as ResultScreenConfig).resultSe2,
          ].filter(Boolean);
          break;
        case "admin":
          bgmAssetId = (config as EndingScreenConfig).endingBgm;
          seAssetIds = [
            (config as EndingScreenConfig).endingSe1,
            (config as EndingScreenConfig).endingSe2,
          ].filter(Boolean);
          break;
      }
      if (bgmAssetId && map[bgmAssetId]) {
        map[bgmAssetId].push(`画面設定: ${config.type} (BGM)`);
      }
      seAssetIds.forEach((aid) => {
        if (map[aid]) map[aid].push(`画面設定: ${config.type} (SE)`);
      });
    });

    return map;
  }
}
