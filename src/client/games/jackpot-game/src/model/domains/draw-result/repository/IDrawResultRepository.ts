import type { LotteryResultDto } from '../../../applications/dto/lottery-result-dto';

export interface IDrawResultRepository {
  fetchDrawResults(): Promise<LotteryResultDto[]>;
  saveDrawResult(result: LotteryResultDto): Promise<void>;
  addDrawResult?(result: LotteryResultDto): Promise<void>;
  updateDrawResult(result: LotteryResultDto): Promise<void>;
  deleteDrawResult(resultId: string): Promise<void>;
}
