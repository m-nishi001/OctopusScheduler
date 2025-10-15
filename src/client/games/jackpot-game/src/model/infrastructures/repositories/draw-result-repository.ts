import { injectable } from "tsyringe";
import type { DrawResultDto } from "../../applications/draw-result/dto/draw-result-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import type { IDrawResultRepository } from "../../domains/draw-result/repository/i-draw-result-repository";

@injectable()
export class DrawResultRepository implements IDrawResultRepository {
  private readonly service;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("DrawResultData")
  );
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async getDrawResults(): Promise<DrawResultDto[]> {
    const allResults = await this.localStorage.getAll<DrawResultDto>();
    return Array.from(allResults.values());
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    return (await this.localStorage.get<DrawResultDto>(drawId)) || null;
  }

  async addDrawResult(result: DrawResultDto): Promise<void> {
    await this.localStorage.save(result.drawId, result);
    if (!this.service) return;
    return new Promise((resolve, reject) => {
      this.service
        .createCall<void>("DrawResultService.saveDrawResult", result)
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updateDrawResult(result: DrawResultDto): Promise<void> {
    await this.localStorage.save(result.drawId, result);
    if (!this.service) return;
    return new Promise((resolve, reject) => {
      this.service
        .createCall<void>("DrawResultService.updateDrawResult", result)
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deleteDrawResult(resultId: string): Promise<void> {
    await this.localStorage.remove(resultId);
    if (!this.service) return;
    return new Promise((resolve, reject) => {
      this.service
        .createCall<void>("DrawResultService.deleteDrawResult", { resultId })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncDrawResults(): Promise<{ synced: number }> {
    if (!this.service) throw new Error("GAS service not available");
    return new Promise((resolve, reject) => {
      this.service
        .createCall<DrawResultDto[]>("DrawResultService.getDrawResults", {})
        .withSuccessed(async (results: DrawResultDto[]) => {
          for (const result of results) {
            await this.localStorage.save(result.drawId, result);
          }
          resolve({ synced: results.length });
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
