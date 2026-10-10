import { injectable } from "tsyringe";
import type { DrawResultDto } from "../../control/draw/dto/draw-result-dto";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { getJackpotScope, scopedStoreName } from "../jackpot-session";

@injectable()
export class DrawResultRepository {
  /** 現在のスコープ(live/demo)に応じたストアを返す。 */
  private get localStorage(): LocalStorageService {
    return new LocalStorageService(
      "jackpot-game",
      scopedStoreName("DrawResultData", getJackpotScope())
    );
  }

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
