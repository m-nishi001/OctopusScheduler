import type { LotteryResultDto } from './lottery-result-dto';

export interface HistoryDto {
  id: string;
  drawName: string;
  result: LotteryResultDto[];
  savedAt: string;
}
