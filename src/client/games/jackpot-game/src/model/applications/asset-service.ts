import { injectable, inject, container } from "tsyringe";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { AssetDto } from "./dto/asset-dto";
import type { MemberDto } from "./dto/member-dto";
import type { PrizeDto } from "./dto/prize-dto";
import type { ScreenConfigDto } from "./dto/screen-config-dto";
import { MemberService } from "./member-service";
import { PrizeService } from "./prize-service";
import { ScreenConfigService } from "./screen-config-service";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async fetchAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.fetchAssets();
    if (!Array.isArray(assets) || !assets) return [];
    return assets.map((a) => ({ ...a }));
  }

  async addAsset(asset: AssetDto): Promise<void> {
    await this.repo.addAsset(asset);
  }

  async addAssets(
    files: File[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: AssetDto[]; failed: File[] }> {
    return this.repo.addAssets(files, onProgress);
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    await this.repo.updateAsset(asset);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAsset(assetId);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    await this.repo.deleteAssets(assetIds);
  }

  async syncAssetsWithGoogleDrive(
    onProgress?: (message: string) => void
  ): Promise<void> {
    await this.repo.syncAssetsWithGoogleDrive(onProgress);
  }

  /**
   * 指定したアセットID群について、使用箇所の文字列配列を返す。
   * UIはこの結果をそのまま表示するだけにする想定。
   */
  async getUsagesForAssets(
    assetIds: string[]
  ): Promise<Record<string, string[]>> {
    // resolve application-level services dynamically to avoid constructor churn / circular deps
    const memberService = container.resolve(MemberService);
    const prizeService = container.resolve(PrizeService);
    const screenConfigService = container.resolve(ScreenConfigService);

    const [members, prizes] = await Promise.all([
      memberService.fetchMembers(),
      prizeService.fetchPrizes(),
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
      screenTypes.map((t) => screenConfigService.fetchScreenConfig(t))
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

  /**
   * 指定したアセットID一覧を逐次削除し、進捗を onProgress に渡す。UI側は進捗表示だけ行う。
   */
  async deleteAssetsWithProgress(
    assetIds: string[],
    onProgress?: (result: {
      id: string;
      success: boolean;
      name?: string;
      completed: number;
      total: number;
    }) => void
  ): Promise<void> {
    const total = assetIds.length;
    let completed = 0;
    for (const id of assetIds) {
      let name: string | undefined = undefined;
      try {
        // try to get local metadata for nicer progress messages
        const asset = await this.repo.getAssetById?.(id as any);
        name = (asset as any)?.name;
      } catch (e) {
        /* ignore */
      }
      try {
        await this.deleteAsset(id);
        completed++;
        onProgress?.({ id, success: true, name, completed, total });
      } catch (e) {
        completed++;
        onProgress?.({ id, success: false, name, completed, total });
      }
    }
  }
}
