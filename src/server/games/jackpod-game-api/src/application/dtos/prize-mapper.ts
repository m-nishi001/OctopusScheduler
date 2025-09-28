import { Prize } from '../../domain/entities/prize';
import { PrizeDto } from './prize-dto';

export function toPrizeDto(entity: Prize): PrizeDto {
  return {
    id: entity.id,
    name: entity.name,
    rank: entity.rank === 'high' ? 1 : entity.rank === 'low' ? 3 : 2,
    order: 0 // 必要に応じて
  };
}

export function toPrize(entity: PrizeDto): Prize {
  return {
    id: entity.id,
    name: entity.name,
    rank: entity.rank === 1 ? 'high' : entity.rank === 3 ? 'low' : 'normal'
  };
}
