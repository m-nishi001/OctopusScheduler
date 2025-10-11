import { injectable } from "tsyringe";
import type { DrawResultDto } from "../../applications/draw-result/dto/draw-result-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";

const DRAW_RESULT_CACHE_KEY = "drawResults";

@injectable()
export class DrawResultRepository {
  private readonly service;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("DrawResultData")
  );
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async getDrawResults(): Promise<DrawResultDto[]> {
    return (
      (await this.localStorage.get<DrawResultDto[]>(DRAW_RESULT_CACHE_KEY)) ||
      []
    );
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    const results = await this.getDrawResults();
    return results.find((r: DrawResultDto) => r.drawId === drawId) || null;
  }

  async saveDrawResult(result: DrawResultDto): Promise<void> {
    const current = await this.getDrawResults();
    const updated = [...current, result];
    await this.localStorage.save(DRAW_RESULT_CACHE_KEY, updated);
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
    const current = await this.getDrawResults();
    const index = current.findIndex((r) => r.drawId === result.drawId);
    if (index === -1) throw new Error("Draw result not found");
    current[index] = result;
    await this.localStorage.save(DRAW_RESULT_CACHE_KEY, current);
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
    const current = await this.getDrawResults();
    const updated = current.filter((r) => r.drawId !== resultId);
    await this.localStorage.save(DRAW_RESULT_CACHE_KEY, updated);
    if (!this.service) return;
    return new Promise((resolve, reject) => {
      this.service
        .createCall<void>("DrawResultService.deleteDrawResult", { resultId })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncDrawResults(): Promise<void> {
    if (!this.service) throw new Error("GAS service not available");
    return new Promise((resolve, reject) => {
      this.service
        .createCall<DrawResultDto[]>("DrawResultService.getDrawResults", {})
        .withSuccessed(async (results: DrawResultDto[]) => {
          await this.localStorage.save(DRAW_RESULT_CACHE_KEY, results);
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
