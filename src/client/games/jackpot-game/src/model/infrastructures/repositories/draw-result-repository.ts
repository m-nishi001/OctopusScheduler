import { injectable } from "tsyringe";
import type { DrawResultDto } from "../../applications/draw-result/dto/draw-result-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class DrawResultRepository {
  private readonly service;
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async getDrawResults(): Promise<DrawResultDto[]> {
    return new Promise((resolve, reject) => {
      this.service
        .createCall<DrawResultDto[]>("DrawResultService.getDrawResults", {})
        .withSuccessed(resolve)
        .withFailuered((message: string) =>
          reject(new Error(`Failed to get draw results: ${message}`))
        )
        .invoke();
    });
  }

  async getDrawResultById(drawId: string): Promise<DrawResultDto | null> {
    const results = await this.getDrawResults();
    return results.find((r: DrawResultDto) => r.drawId === drawId) || null;
  }
}
