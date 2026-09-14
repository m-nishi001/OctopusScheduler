import { injectable } from "tsyringe";
import type { DrawResultDto } from "../../applications/draw/dto/draw-result-dto";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import type { IDrawResultRepository } from "../../domains/draw/repository/i-draw-result-repository";

@injectable()
export class DrawResultRepository implements IDrawResultRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "DrawResultData"
  );

  async getDrawResults(): Promise<DrawResultDto[]> {
    const allResults = await this.localStorage.getAll<DrawResultDto>();
    const arr = Array.from(allResults.values());
    try {
      console.log(
        "[DrawResultRepository] getDrawResults: count=",
        arr.length,
        "ids=",
        arr.map((r) => r.drawId)
      );
    } catch (e) {
      /* ignore logging errors */
    }
    return arr;
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    const res = (await this.localStorage.get<DrawResultDto>(drawId)) || null;
    try {
      console.log("[DrawResultRepository] getDrawResultById:", drawId, res);
    } catch (e) {}
    return res;
  }

  async addDrawResult(result: DrawResultDto): Promise<void> {
    try {
      console.log(
        "[DrawResultRepository] addDrawResult:",
        result.drawId,
        result
      );
    } catch (e) {}
    await this.localStorage.save(result.drawId, result);
  }

  async updateDrawResult(result: DrawResultDto): Promise<void> {
    try {
      console.log(
        "[DrawResultRepository] updateDrawResult:",
        result.drawId,
        result
      );
    } catch (e) {}
    await this.localStorage.save(result.drawId, result);
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    try {
      console.log("[DrawResultRepository] deleteDrawResult:", resultId);
    } catch (e) {}
    await this.localStorage.delete(resultId);
  }

  async syncDrawResults(): Promise<{ synced: number }> {
    return { synced: 0 };
  }
}
