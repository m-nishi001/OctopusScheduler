import { injectable } from "tsyringe";

import { Member } from '../../domain/entities/member';
import { Prize } from '../../domain/entities/prize';
import { Result } from '../../domain/entities/result';
import { GasService } from "./gas-service";
import { DrawResultService } from "./draw-result-service";
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
    drawMember(args: { members: Member[], weights?: number[] }): Member {
        return this.memberDrawStrategy(args.members, { weights: args.weights });
    }

    // 景品抽選（確率調整可能）
    drawPrize(args: { prizes: Prize[], weights?: number[] }): Prize {
        return this.prizeDrawStrategy(args.prizes, { weights: args.weights });
    }

    // 一括抽選（メンバー×景品）
    drawAll(args: { prizes: Prize[], members: Member[], memberWeights?: number[], prizeWeights?: number[] }): Result[] {
        const members = args.members.slice();
        const prizes = args.prizes.slice();
        const memberWeights = args.memberWeights;
        const prizeWeights = args.prizeWeights;
        const results: Result[] = [];

        // シャッフルしてペアリング（重複なし）
        const shuffledMembers = this.shuffleWithWeights(members, memberWeights);
        const shuffledPrizes = this.shuffleWithWeights(prizes, prizeWeights);
        const count = Math.min(shuffledMembers.length, shuffledPrizes.length);
        for (let i = 0; i < count; i++) {
            results.push({
                memberId: shuffledMembers[i].id,
                prizeId: shuffledPrizes[i].id,
                order: i + 1,
                isWinner: true
            });
        }
        // 保存処理（非同期）
        if (this.drawResultService !== undefined) {
            results.forEach(result => {
                this.drawResultService?.save({
                    result: {
                        drawId: `${result.memberId}_${result.prizeId}`,
                        member: shuffledMembers.find(m => m.id === result.memberId)!,
                        prize: shuffledPrizes.find(p => p.id === result.prizeId)!,
                        rank: shuffledPrizes.find(p => p.id === result.prizeId)?.rank || "normal"
                    }
                });
            });
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
