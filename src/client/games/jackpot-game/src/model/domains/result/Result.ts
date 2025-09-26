import type { LotteryResult } from "../draw-result/DrawResult";

export interface Result {
  drawId: string;
  results: LotteryResult[];
  executedAt: string;
}
