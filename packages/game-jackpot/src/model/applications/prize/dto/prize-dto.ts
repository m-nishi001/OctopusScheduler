import type { Prize } from "domains/prize/prize";

export interface PrizeDto {
  id: string;
  name: string;
  rank?: number;
  imageAssetId?: string;
  image2AssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  animation?: string;
  order: number;
  winningImage1AssetId?: string;
  winningImage2AssetId?: string;
}

export const toPrize = (dto: PrizeDto): Prize => ({
  id: dto.id,
  name: dto.name,
  rank: dto.rank,
  imageAssetId: dto.imageAssetId,
  image2AssetId: dto.image2AssetId,
  bgm1AssetId: dto.bgm1AssetId,
  bgm2AssetId: dto.bgm2AssetId,
  animation: dto.animation,
  order: dto.order,
  winningImage1AssetId: dto.winningImage1AssetId,
  winningImage2AssetId: dto.winningImage2AssetId,
});

export const fromPrize = (prize: Prize): PrizeDto => ({
  id: prize.id,
  name: prize.name,
  rank: prize.rank,
  imageAssetId: prize.imageAssetId,
  image2AssetId: prize.image2AssetId,
  bgm1AssetId: prize.bgm1AssetId,
  bgm2AssetId: prize.bgm2AssetId,
  animation: prize.animation || "roulette",
  order: prize.order,
  winningImage1AssetId: prize.winningImage1AssetId,
  winningImage2AssetId: prize.winningImage2AssetId,
});
