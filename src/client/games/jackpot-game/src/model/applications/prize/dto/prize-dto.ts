import type { Prize } from "../../../domains/prize/prize";

export interface PrizeDto {
  id: string;
  name: string;
  probability: number;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  isAssigned?: boolean;
  isReserved?: boolean;
  // animation to be used for this prize's draw presentation
  animation?: string;
  order: number;
  imageDataUrl?: string;
}

export const toPrize = (dto: PrizeDto): Prize => ({
  id: dto.id,
  name: dto.name,
  probability: dto.probability,
  rank: dto.rank,
  imageAssetId: dto.imageAssetId,
  bgm1AssetId: dto.bgm1AssetId,
  bgm2AssetId: dto.bgm2AssetId,
  isAssigned: dto.isAssigned,
  isReserved: dto.isReserved,
  animation: dto.animation,
  order: dto.order,
  imageDataUrl: dto.imageDataUrl,
});

export const fromPrize = (prize: Prize): PrizeDto => ({
  id: prize.id,
  name: prize.name,
  probability: prize.probability,
  rank: prize.rank,
  imageAssetId: prize.imageAssetId,
  bgm1AssetId: prize.bgm1AssetId,
  bgm2AssetId: prize.bgm2AssetId,
  isAssigned: prize.isAssigned,
  isReserved: prize.isReserved,
  animation: prize.animation || "roulette",
  order: prize.order,
  imageDataUrl: prize.imageDataUrl,
});
