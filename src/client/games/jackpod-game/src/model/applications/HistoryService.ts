import type { History } from '../domains/history/History';
import { historyApi } from '../infrastructures/api/historyApi';

export class HistoryService {
  async getHistory(): Promise<History[]> {
    return await historyApi.getHistory();
  }
}
