import type { Prize } from "../../../domains/prize/prize";

export interface PrizeDto {
  id: string;
  name: string;
  probability: number;
  rank?: number;
  imageAssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  order: number;
}

export const toPrize = (dto: PrizeDto): Prize => ({
  id: dto.id,
  name: dto.name,
  probability: dto.probability,
  rank: dto.rank,
  imageAssetId: dto.imageAssetId,
  bgm1AssetId: dto.bgm1AssetId,
  bgm2AssetId: dto.bgm2AssetId,
  order: dto.order,
});

export const fromPrize = (prize: Prize): PrizeDto => ({
  id: prize.id,
  name: prize.name,
  probability: prize.probability,
  rank: prize.rank,
  imageAssetId: prize.imageAssetId,
  bgm1AssetId: prize.bgm1AssetId,
  bgm2AssetId: prize.bgm2AssetId,
  order: prize.order,
});
