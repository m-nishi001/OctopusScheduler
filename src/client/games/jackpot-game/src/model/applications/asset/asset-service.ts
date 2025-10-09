import { injectable, inject, container } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import { AssetDto } from "./dto/asset-dto";
import type { MemberDto } from "../member/dto/member-dto";
import type { PrizeDto } from "../prize/dto/prize-dto";
import type { ScreenConfigDto } from "../screen-config/dto/screen-config-dto";
import { MemberService } from "../member/member-service";
import { PrizeService } from "../prize/prize-service";
import { ScreenConfigService } from "../screen-config/screen-config-service";

@injectable()
export class AssetService {
  constructor(@inject("IAssetRepository") private repo: IAssetRepository) {}

  async fetchAssets(): Promise<AssetDto[]> {
    const assets = await this.repo.fetchAssets();
    if (!Array.isArray(assets) || !assets) return [];
    return assets.map((a) => new AssetDto(a));
  }

  async getAssetById(assetId: string): Promise<AssetDto | undefined> {
    const asset = await this.repo.getAssetById(assetId);
    return asset ? new AssetDto(asset) : undefined;
  }

  async addAsset(asset: AssetDto): Promise<AssetDto> {
    const assetEntity = await asset.toAsset();
    const result = await this.repo.addAssets([assetEntity]);
    asset.id = result.successful[0].id;
    return asset;
  }

  async addAssets(
    files: File[] | AssetDto[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: AssetDto[]; failed: AssetDto[] }> {
    let assetDtos: AssetDto[];
    if (files.length > 0 && files[0] instanceof File) {
      assetDtos = (files as File[]).map((file) => new AssetDto(file));
    } else {
      assetDtos = files as AssetDto[];
    }
    const assetEntities = await Promise.all(
      assetDtos.map((dto) => dto.toAsset())
    );
    const result = await this.repo.addAssets(assetEntities, onProgress);
    // id をセット
    result.successful.forEach((asset, index) => {
      assetDtos[index].id = asset.id;
    });
    return {
      successful: result.successful
        .map(
          (asset) =>
            assetDtos.find(
              (dto) => dto.name === asset.name && dto.size === asset.size
            )!
        )
        .filter(Boolean),
      failed: result.failed
        .map(
          (asset) =>
            assetDtos.find(
              (dto) => dto.name === asset.name && dto.size === asset.size
            )!
        )
        .filter(Boolean),
    };
  }

  async updateAsset(asset: AssetDto): Promise<void> {
    const assetEntity = await asset.toAsset();
    await this.repo.updateAssets([assetEntity]);
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.repo.deleteAssets([assetId]);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    await this.repo.deleteAssets(assetIds);
  }

  async syncAssetsWithGoogleDrive(
    onProgress?: (message: string) => void
  ): Promise<void> {
    await this.repo.syncAssetsWithGoogleDrive(onProgress);
  }

  async getUsagesForAssets(
    assetIds: string[]
  ): Promise<Record<string, string[]>> {
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
        const asset = await this.repo.getAssetById?.(id as any);
        name = (asset as any)?.name;
      } catch (e) {
        /* ignore */
      }
      try {
        await this.deleteAssets([id]);
        completed++;
        onProgress?.({ id, success: true, name, completed, total });
      } catch (e) {
        completed++;
        onProgress?.({ id, success: false, name, completed, total });
      }
    }
  }
}
