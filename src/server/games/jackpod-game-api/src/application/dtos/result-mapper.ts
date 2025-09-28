import { Result } from '../../domain/entities/result';
import { ResultDto } from './result-dto';

export function toResultDto(entity: Result): ResultDto {
  return {
    memberId: entity.memberId,
    prizeId: entity.prizeId,
    order: entity.order,
    isWinner: entity.isWinner
  };
}

export function toResult(entity: ResultDto): Result {
  return {
    memberId: entity.memberId,
    prizeId: entity.prizeId,
    order: entity.order,
    isWinner: entity.isWinner
  };
}
