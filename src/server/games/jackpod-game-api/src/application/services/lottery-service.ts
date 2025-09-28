import { injectable } from "tsyringe";

import { Member } from '../../domain/entities/member';
import { Prize } from '../../domain/entities/prize';
import { MemberDto } from '../dtos/member.dto';
import { PrizeDto } from '../dtos/prize.dto';
import { toMember, toMemberDto } from '../dtos/member.mapper';
import { toPrize, toPrizeDto } from '../dtos/prize.mapper';
import { DrawResultDto } from '../dtos/draw-result.dto';
import { GasService } from "./gas.service";
import { DrawResultService } from "./draw-result.service";
import { inject } from "tsyringe";

@injectable()
export class LotteryService implements GasService {
    public serviceName = "LotteryService";
    public functions: Record<string, (args: any) => any>;

    private memberDrawStrategy: (members: Member[], options?: { weights?: number[] }) => Member;
    private prizeDrawStrategy: (prizes: Prize[], options?: { weights?: number[] }) => Prize;

    constructor(@inject(DrawResultService) private drawResultService?: DrawResultService) {
        // デフォルト抽選ロジック（均等確率）
        this.memberDrawStrategy = this.uniformRandomDraw;
        this.prizeDrawStrategy = this.uniformRandomDraw;
        this.functions = {
            drawMember: this.drawMember.bind(this),
            drawPrize: this.drawPrize.bind(this),
            drawAll: this.drawAll.bind(this)
        };
    }

    // メンバー抽選（確率調整可能）
    drawMember(args: { members: MemberDto[], weights?: number[] }): MemberDto {
        const domainMembers = args.members.map(toMember);
        const drawn = this.memberDrawStrategy(domainMembers, { weights: args.weights });
        return toMemberDto(drawn);
    }

    drawPrize(args: { prizes: PrizeDto[], weights?: number[] }): PrizeDto {
        const domainPrizes = args.prizes.map(toPrize);
        const drawn = this.prizeDrawStrategy(domainPrizes, { weights: args.weights });
        return toPrizeDto(drawn);
    }

    drawAll(args: { prizes: PrizeDto[], members: MemberDto[], memberWeights?: number[], prizeWeights?: number[] }): DrawResultDto[] {
        const members = args.members.map(toMember);
        const prizes = args.prizes.map(toPrize);
        const memberWeights = args.memberWeights;
        const prizeWeights = args.prizeWeights;
        const results: DrawResultDto[] = [];

        // シャッフルしてペアリング（重複なし）
        const shuffledMembers = this.shuffleWithWeights(members, memberWeights);
        const shuffledPrizes = this.shuffleWithWeights(prizes, prizeWeights);
        const count = Math.min(shuffledMembers.length, shuffledPrizes.length);
        for (let i = 0; i < count; i++) {
            const memberEntity = shuffledMembers[i];
            const prizeEntity = shuffledPrizes[i];
            const memberDto = { ...toMemberDto(memberEntity), order: i + 1 };
            const prizeDto = { ...toPrizeDto(prizeEntity), order: i + 1 };
            const drawResult: DrawResultDto = {
                drawId: `${memberDto.id}_${prizeDto.id}`,
                member: memberDto,
                prize: prizeDto,
                rank: typeof prizeDto.rank === 'string' ? prizeDto.rank : String(prizeDto.rank || "normal"),
                order: i + 1,
                isWinner: true // 抽選結果なのでtrueで固定（必要に応じてロジック変更可）
            };
            results.push(drawResult);
            this.drawResultService?.save({ result: drawResult });
        }
        return results;
    }

    // --- 抽選ロジック（Strategy） ---
    // 均等確率抽選
    private uniformRandomDraw<T>(items: T[], options?: { weights?: number[] }): T {
        if (!items.length) throw new Error("No items to draw");
        if (options?.weights && options.weights.length === items.length) {
            // 重み付き抽選
            const total = options.weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < items.length; i++) {
                r -= options.weights[i];
                if (r < 0) return items[i];
            }
            return items[items.length - 1];
        }
        // 均等抽選
        const idx = Math.floor(Math.random() * items.length);
        return items[idx];
    }

    // 重み付きシャッフル
    private shuffleWithWeights<T>(items: T[], weights?: number[]): T[] {
        if (!weights || weights.length !== items.length) {
            // 通常シャッフル
            return items.slice().sort(() => Math.random() - 0.5);
        }
        // 重み付きシャッフル
        const result: T[] = [];
        const pool = items.slice();
        const poolWeights = weights.slice();
        while (pool.length) {
            const selected = this.uniformRandomDraw(pool, { weights: poolWeights });
            const idx = pool.indexOf(selected);
            result.push(selected);
            pool.splice(idx, 1);
            poolWeights.splice(idx, 1);
        }
        return result;
    }
}
