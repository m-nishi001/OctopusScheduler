import type { LotteryResult } from '../../domains/draw-result/DrawResult';

export interface ResultResponse {
  results: LotteryResult[];
}
