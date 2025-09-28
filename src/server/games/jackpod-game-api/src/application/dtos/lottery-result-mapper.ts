
import { ResultDto } from './result-dto';
import { Result } from '../../domain/entities/result';

export function toLotteryResultDto(entity: Result): ResultDto {
  return {
    memberId: entity.memberId,
    prizeId: entity.prizeId,
    order: entity.order,
    isWinner: entity.isWinner
  };
}

export function toResultFromLotteryDto(dto: ResultDto): Result {
  return {
    memberId: dto.memberId,
    prizeId: dto.prizeId,
    order: dto.order,
    isWinner: dto.isWinner
  };
}
