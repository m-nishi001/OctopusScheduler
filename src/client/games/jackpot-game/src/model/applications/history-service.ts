import type { HistoryDto } from './dto/history-dto';
import { HistoryRepository } from '../infrastructures/repository/history-repository';

export class HistoryService {
    private readonly repo = new HistoryRepository();
    async getHistory(): Promise<HistoryDto[]> {
        const history = await this.repo.getHistory();
        // DrawResult[] -> LotteryResultDto[] へ変換
        return history.map(h => ({
            id: h.id,
            drawName: h.drawName,
            result: h.result?.results
                ? h.result.results.map(r => ({
                    memberId: r.member.id,
                    prizeId: r.prize.id,
                    order: r.order,
                    isWinner: r.isWinner
                }))
                : [],
            savedAt: h.savedAt
        }));
    }
}
