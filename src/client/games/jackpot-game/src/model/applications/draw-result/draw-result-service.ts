import { injectable, inject } from "tsyringe";
import type { IDrawResultRepository } from "../../domains/draw-result/repository/i-draw-result-repository";
import type { DrawResultDto } from "./dto/draw-result-dto";

@injectable()
export class DrawResultService {
  constructor(
    @inject("IDrawResultRepository") private repo: IDrawResultRepository
  ) {}

  async getDrawResults(): Promise<DrawResultDto[]> {
    return await this.repo.getDrawResults();
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    return await this.repo.getDrawResultById(drawId);
  }

  async addDrawResult(result: DrawResultDto): Promise<void> {
    await this.repo.addDrawResult(result);
  }

  async updateDrawResult(result: DrawResultDto): Promise<void> {
    await this.repo.updateDrawResult(result);
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    await this.repo.deleteDrawResult(resultId);
  }

  async syncDrawResults(): Promise<void> {
    // サーバーから全抽選結果を取得してローカルストレージに同期
    await this.repo.syncDrawResults();
  }
}
