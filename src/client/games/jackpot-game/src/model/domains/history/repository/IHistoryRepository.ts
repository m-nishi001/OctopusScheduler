import type { HistoryDto } from '../../../applications/dto/history-dto';

export interface IHistoryRepository {
  getHistory(): Promise<HistoryDto[]>;
}
