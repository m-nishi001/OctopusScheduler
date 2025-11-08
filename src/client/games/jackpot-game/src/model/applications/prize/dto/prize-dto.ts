import type { Prize } from "domains/prize/prize";

export interface PrizeDto {
  id: string;
  name: string;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  // animation to be used for this prize's draw presentation
  animation?: string;
  order: number;
}

export const toPrize = (dto: PrizeDto): Prize => ({
  id: dto.id,
  name: dto.name,
  rank: dto.rank,
  imageAssetId: dto.imageAssetId,
  bgm1AssetId: dto.bgm1AssetId,
  bgm2AssetId: dto.bgm2AssetId,
  animation: dto.animation,
  order: dto.order,
});

export const fromPrize = (prize: Prize): PrizeDto => ({
  id: prize.id,
  name: prize.name,
  rank: prize.rank,
  imageAssetId: prize.imageAssetId,
  bgm1AssetId: prize.bgm1AssetId,
  bgm2AssetId: prize.bgm2AssetId,
  animation: prize.animation || "roulette",
  order: prize.order,
});
