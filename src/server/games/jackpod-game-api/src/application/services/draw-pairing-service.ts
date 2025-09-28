import { injectable } from "tsyringe";
import { Member } from "../../domain/entities/member";
import { Prize } from "../../domain/entities/prize";
import { DrawResultDto } from "../dtos/draw-result.dto";
import { toMemberDto } from "../dtos/member.mapper";
import { toPrizeDto } from "../dtos/prize.mapper";
import { DrawResultService } from "./draw-result-service";

@injectable()
export class DrawPairingService {
  constructor(private drawResultService?: DrawResultService) {}

  pairAndSave(
    members: Member[],
    prizes: Prize[],
    memberWeights?: number[],
    prizeWeights?: number[]
  ): DrawResultDto[] {
    const shuffledMembers = this.shuffleWithWeights(members, memberWeights);
    const shuffledPrizes = this.shuffleWithWeights(prizes, prizeWeights);
    const count = Math.min(shuffledMembers.length, shuffledPrizes.length);
    const results: DrawResultDto[] = [];
    for (let i = 0; i < count; i++) {
      const memberEntity = shuffledMembers[i];
      const prizeEntity = shuffledPrizes[i];
      const memberDto = { ...toMemberDto(memberEntity), order: i + 1 };
      const prizeDto = { ...toPrizeDto(prizeEntity), order: i + 1 };
      const drawResult: DrawResultDto = {
        drawId: `${memberDto.id}_${prizeDto.id}`,
        member: memberDto,
        prize: prizeDto,
        rank:
          typeof prizeDto.rank === "string"
            ? prizeDto.rank
            : String(prizeDto.rank || "normal"),
        order: i + 1,
        isWinner: true,
      };
      results.push(drawResult);
      this.drawResultService?.save({ result: drawResult });
    }
    return results;
  }

  private shuffleWithWeights<T>(items: T[], weights?: number[]): T[] {
    if (!weights || weights.length !== items.length) {
      return items.slice().sort(() => Math.random() - 0.5);
    }
    const result: T[] = [];
    const pool = items.slice();
    const poolWeights = weights.slice();
    while (pool.length) {
      const selected = this.selectWeighted(pool, poolWeights);
      const idx = pool.indexOf(selected);
      result.push(selected);
      pool.splice(idx, 1);
      poolWeights.splice(idx, 1);
    }
    return result;
  }

  private selectWeighted<T>(pool: T[], poolWeights: number[]): T {
    const total = poolWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= poolWeights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}
