import type { HistoryDto } from "../../../applications/history/dto/history-dto";

export interface IHistoryRepository {
  getHistory(): Promise<HistoryDto[]>;
}
