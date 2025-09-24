import type { History } from '../domains/history/History';
import { HistoryRepository } from '../infrastructures/repository/history-repository';

export class HistoryService {
    private readonly repo = new HistoryRepository();
    async getHistory(): Promise<History[]> {
        return await this.repo.getHistory();
    }
}
