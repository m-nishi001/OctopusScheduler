import type { History } from '../../domains/history/History';

export interface HistoryRepository {
  getHistory(): Promise<History[]>;
  saveHistory(history: History): Promise<void>;
}
