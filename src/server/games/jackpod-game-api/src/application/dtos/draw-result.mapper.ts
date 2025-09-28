import { DrawResult } from '../../domain/entities/draw-result';
import { DrawResultDto } from './draw-result.dto';
import { toMemberDto, toMember } from './member.mapper';
import { toPrizeDto, toPrize } from './prize.mapper';

export function toDrawResultDto(entity: DrawResult): DrawResultDto {
  return {
    drawId: entity.drawId,
    member: toMemberDto(entity.member),
    prize: toPrizeDto(entity.prize),
    rank: entity.rank,
    order: entity.order,
    isWinner: entity.isWinner
  };
}

export function toDrawResult(entity: DrawResultDto): DrawResult {
  return {
    drawId: entity.drawId,
    member: toMember(entity.member),
    prize: toPrize(entity.prize),
    rank: entity.rank,
    order: entity.order,
    isWinner: entity.isWinner
  };
}
