import { injectable, inject } from "tsyringe";
import type { IDrawResultRepository } from "../domains/draw-result/repository/IDrawResultRepository";
import type { LotteryResultDto } from "./dto/lottery-result-dto";

@injectable()
export class DrawResultService {
  constructor(
    @inject("IDrawResultRepository") private repo: IDrawResultRepository
  ) {}

  async fetchDrawResults(): Promise<LotteryResultDto[]> {
    return await this.repo.fetchDrawResults();
  }

  async addDrawResult(result: LotteryResultDto): Promise<void> {
    if (this.repo.addDrawResult) {
      await this.repo.addDrawResult(result);
    } else {
      await this.repo.saveDrawResult(result);
    }
  }

  async updateDrawResult(result: LotteryResultDto): Promise<void> {
    await this.repo.updateDrawResult(result);
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    await this.repo.deleteDrawResult(resultId);
  }
}
