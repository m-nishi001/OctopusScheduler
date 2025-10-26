import { injectable } from "tsyringe";
import type { DrawResultDto } from "../applications/draw/dto/draw-result-dto";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IDrawResultRepository } from "../domains/draw/repository/i-draw-result-repository";

@injectable()
export class DrawResultRepository implements IDrawResultRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "DrawResultData"
  );

  async getDrawResults(): Promise<DrawResultDto[]> {
    const allResults = await this.localStorage.getAll<DrawResultDto>();
    return Array.from(allResults.values());
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    return (await this.localStorage.get<DrawResultDto>(drawId)) || null;
  }

  async addDrawResult(result: DrawResultDto): Promise<void> {
    await this.localStorage.save(result.drawId, result);
  }

  async updateDrawResult(result: DrawResultDto): Promise<void> {
    await this.localStorage.save(result.drawId, result);
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    await this.localStorage.delete(resultId);
  }

  async syncDrawResults(): Promise<{ synced: number }> {
    // GAS sync removed
    return { synced: 0 };
  }
}
