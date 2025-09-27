import type { HistoryDto } from './dto/CommonDtos';
import { HistoryRepository } from '../infrastructures/repository/history-repository';

export class HistoryService {
    private readonly repo = new HistoryRepository();
    async getHistory(): Promise<HistoryDto[]> {
        const history = await this.repo.getHistory();
        // Entity -> DTO変換（必要ならマッピング処理を追加）
        return history.map(h => ({
            id: h.id,
            drawName: h.drawName,
            result: h.result?.results ? h.result.results.map(r => ({ ...r })) : [],
            savedAt: h.savedAt
        }));
    }
}
