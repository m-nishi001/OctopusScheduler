import { injectable, inject } from "tsyringe";
import { DrawResultRepository } from "../../model/draw/draw-result-repository";
import type { DrawResultDto } from "./dto/draw-result-dto";

/** 抽選結果の取得・追加・更新・削除と、同期。 */
@injectable()
export class DrawResultService {
  constructor(
    @inject(DrawResultRepository) private readonly repo: DrawResultRepository
  ) {}

  async getDrawResults(): Promise<DrawResultDto[]> {
    const res = await this.repo.getDrawResults();
    try {
      console.log("[DrawResultService] getDrawResults: count=", res.length);
    } catch (e) {}
    return res;
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    const res = await this.repo.getDrawResultById(drawId);
    try {
      console.log("[DrawResultService] getDrawResultById:", drawId, res);
    } catch (e) {}
    return res;
  }

  async addDrawResult(result: DrawResultDto): Promise<void> {
    console.log("[DrawResultService] addDrawResult:", result);
    await this.repo.addDrawResult(result);
  }

  async updateDrawResult(result: DrawResultDto): Promise<void> {
    console.log("[DrawResultService] updateDrawResult:", result);
    await this.repo.updateDrawResult(result);
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    await this.repo.deleteDrawResult(resultId);
  }

  async syncDrawResults(): Promise<{ synced: number }> {
    return await this.repo.syncDrawResults();
  }
}
