import type { LotteryResultDto } from './LotteryResultDto';

export interface HistoryDto {
  id: string;
  drawName: string;
  result: LotteryResultDto[];
  savedAt: string;
}
