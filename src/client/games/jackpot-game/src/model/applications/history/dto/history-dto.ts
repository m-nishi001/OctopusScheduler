import type { LotteryResultDto } from "../../draw/dto/lottery-result-dto";

export interface HistoryDto {
  id: string;
  drawName: string;
  result: LotteryResultDto[];
  savedAt: string;
}
