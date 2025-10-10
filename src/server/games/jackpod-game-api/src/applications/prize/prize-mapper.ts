import { Prize } from "../../domain/entities/prize";
import { PrizeDto } from "./prize-dto";

export function toPrizeDto(entity: Prize): PrizeDto {
  return {
    id: entity.id,
    name: entity.name,
    probability: entity.probability,
    rank: entity.rank,
    imageAssetId: entity.imageAssetId,
    bgm1AssetId: entity.bgm1AssetId,
    bgm2AssetId: entity.bgm2AssetId,
    order: entity.order,
  };
}

export function toPrize(dto: PrizeDto): Prize {
  return {
    id: dto.id,
    name: dto.name,
    probability: dto.probability,
    rank: dto.rank,
    imageAssetId: dto.imageAssetId,
    bgm1AssetId: dto.bgm1AssetId,
    bgm2AssetId: dto.bgm2AssetId,
    order: dto.order,
  };
}
